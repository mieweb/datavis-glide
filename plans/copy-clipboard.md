# Plan: Copy Selection to Clipboard

This plan covers the Copy Selection to Clipboard feature (DataVis Q2 2026 OKR 2) in the DataVis GLIDE repository. It is entirely GLIDE-side — no DataVis ACE engine changes are required; the existing `Csv` class (imported from `datavis-ace`) is reused with a tab separator.

## Background

The grid already supports row selection via checkboxes when the `rowSelect` feature is enabled. The renderer exposes the current selection, and the grid already listens for selection changes to update its titlebar count:

- `GridTable.prototype.getSelection` ([src/renderers/grid/table.js#L2178](../src/renderers/grid/table.js#L2178)) returns `{ rowIds: [...], rows: [...] }`, where `rows` are the raw data objects.
- The grid wires a `selectionChange` listener ([src/grid.js#L1547](../src/grid.js#L1547)) that updates the selection count text.
- The CSV export button is built in the titlebar ([src/grid.js#L1301](../src/grid.js#L1301)) and its state is managed by `_setExportStatus` ([src/grid.js#L2204](../src/grid.js#L2204)); export itself uses `presentDownload` ([src/grid.js#L2186](../src/grid.js#L2186)).

Today the only thing a user can do with a selection is trigger custom operations. The most natural action — copying selected rows to paste elsewhere — is missing.

This plan adds **two** ways to choose what gets copied: the existing checkbox **row selection**, and a new **rectangular cell selection** (a spreadsheet-style click-and-drag marquee). Relevant facts for the marquee:

- Data rows render as `<tr data-row-num="N">`; cells render as `<td>` that carries `data-wcdv-field` **only** when the field has a `maxHeight` or operations ([src/renderers/grid/table/plain.js#L670](../src/renderers/grid/table/plain.js#L670)). To map any cell back to `(rowNum, field)` reliably, the field attribute must be present on every data cell.
- The grid already has a working `mousedown → document mousemove → document mouseup` drag pattern in the column-resize handle ([src/renderers/grid/table.js#L512](../src/renderers/grid/table.js#L512)), which this feature follows.
- There is **no** existing notion of a cell range / marquee / active cell anywhere in the codebase; selection today is strictly row-based (`self.selection` array of rowNums). The cell rectangle is a new, parallel concept.
- The "show full value" path already reads a cell via `td.attr('data-wcdv-field')` + `tr.attr('data-row-num')` and `data.data[rowNum].rowData[field]` ([src/renderers/grid/table.js#L1370](../src/renderers/grid/table.js#L1370)) — reuse this mapping.

## Customer-facing behavior

### Copying a row selection (checkboxes)

1. When `rowSelect` is enabled and ≥1 row is selected, a **copy button** (clipboard icon) appears in the titlebar next to the CSV export button.
2. The copied data includes a **header row** of column display names, only **visible** columns (not hidden via column config), in **display order**.

### Selecting a rectangle of cells (click-and-drag)

3. When the new `cellSelect` feature is enabled, the user can **press the mouse button on a data cell and drag** to another cell to select the rectangular block of cells between the anchor and focus cells, in the current display order. The block is highlighted live while dragging and after release. A press-and-release within one cell selects that single cell.
4. **Starting a cell drag clears any existing row (checkbox) selection**, and ticking a row checkbox clears any cell rectangle — the two selection modes are **mutually exclusive**; at most one is active at a time.
5. Cell-rectangle selection applies to **plain** (ungrouped, unpivoted) output only.
6. Sorting, filtering, paginating, or otherwise **redrawing** the grid clears the cell selection.

### Copying (either selection)

7. Clicking the copy button — or pressing **Ctrl+C / Cmd+C** while the grid has focus — copies the **active** selection to the clipboard as **tab-separated values** (TSV):
   - Row selection → all visible columns of the selected rows, **with a header row** of column display names.
   - Cell rectangle → exactly the selected cells (the spanned visible columns of the spanned rows), **with no header row** — just like copying a range in a spreadsheet.
8. A brief **toast** confirms the action ("N rows copied to clipboard" or "N cells copied to clipboard") and auto-dismisses (~2s).
9. The copy button is **enabled** whenever either selection is non-empty, **disabled** when both are empty. Ctrl/Cmd+C is a **no-op** when nothing is selected (does not hijack the browser's normal copy).

## Implementation Steps

### 1. Clipboard utility — `src/util/clipboard.js` (new)

Create a small, reusable IE11-safe writer:

```javascript
export function writeToClipboard(text) {
	if (navigator.clipboard && navigator.clipboard.writeText) {
		return navigator.clipboard.writeText(text);
	}
	// IE11 / non-secure-context fallback.
	var textArea = document.createElement('textarea');
	textArea.value = text;
	textArea.setAttribute('readonly', '');
	textArea.style.position = 'fixed';
	textArea.style.left = '-999999px';
	document.body.appendChild(textArea);
	textArea.select();
	var ok = false;
	try {
		ok = document.execCommand('copy');
	}
	catch (e) {
		ok = false;
	}
	document.body.removeChild(textArea);
	return ok ? Promise.resolve() : Promise.reject(new Error('Clipboard write failed'));
}
```

- Feature-detect `navigator.clipboard.writeText`; fall back to a hidden `<textarea>` +
  `document.execCommand('copy')` for IE11 and non-secure contexts.
- Returns a promise in both paths so callers can chain the toast and handle failure.
- IE11-safe: `var`, function declarations, no arrow functions/template strings.

### 2. Toast component — `src/ui/toast.js` (new)

A minimal, reusable, accessible transient-message widget following the established widget pattern (`makeSubclass`, `var self = this`):

- Constructor builds `self.ui.root` as a container with `role="status"` and `aria-live="polite"` so screen readers announce updates.
- `show(text)` sets the message, makes the toast visible, and auto-dismisses after ~2000ms (clear any prior timer first so rapid copies don't stack).
- `hide()` / `destroy()` remove the element and clear the timer.
- Styles live in `wcdatavis.css` under a scoped class (e.g. `wcdv_toast`): fixed/anchored position, subtle background, fade out. Keep scoped and minimal; no global resets.
- Reusable by other features later (not coupled to copy).

### 3. Cell rectangle selection (marquee) — `src/renderers/grid/table/plain.js` (+ `table.js` API)

Introduce a new `cellSelect` feature flag, parallel to `rowSelect`. Marquee selection is implemented in the **plain** renderer only.

**(a) Make every data cell addressable.** Extend the cell-building loop ([src/renderers/grid/table/plain.js#L625](../src/renderers/grid/table/plain.js#L625)) to **always** set `data-wcdv-field` on each data `<td>` (today it is conditional, ~L670). Combined with the existing `data-row-num` on the `<tr>`, this maps any cell to `(rowNum, field)`. Column order/index is derived from `determineColumns(...)` (display order), **not** from DOM cell position (rows have a leading checkbox/spacer cell).

**(b) Selection state.** Add `self.cellSelection` on the plain renderer holding the corner cells plus a derived, normalized rectangle:

```javascript
self.cellSelection = {
	anchor: { rowNum: ..., field: ... },
	focus:  { rowNum: ..., field: ... },
	rowNums: [ ... ], // visible rows between anchor & focus, in display order
	fields:  [ ... ]  // visible columns between anchor & focus, in display order
};
```

`rowNums`/`fields` are recomputed from the anchor and focus using the rendered rows' display order and the `determineColumns` field order.

**(c) Marquee drag.** Follow the column-resize drag pattern (`mousedown → document mousemove → document mouseup`, namespaced) at [src/renderers/grid/table.js#L512](../src/renderers/grid/table.js#L512):

- Bind `mousedown.wcdv_cell_marquee` on `self.ui.tbody`, delegated to data `<td>` (exclude the checkbox/spacer cell), only when `self.features.cellSelect`.
- **mousedown**: `evt.preventDefault()` (the table already suppresses native text selection at [src/renderers/grid/table.js#L1042](../src/renderers/grid/table.js#L1042)); read the anchor cell from the `<td>`'s `data-wcdv-field` and its `<tr>`'s `data-row-num`; set `focus = anchor`; **clear any row selection** (see (e)); set a `self._cellDragging` flag; bind `mousemove.wcdv_cell_marquee` and `mouseup.wcdv_cell_marquee` on `document`.
- **mousemove**: resolve the cell under the pointer (`document.elementFromPoint`, or `evt.target.closest('td')`); if it is a data cell, update `focus`, recompute the rectangle, and refresh the highlight.
- **mouseup**: finalize `self.cellSelection`, fire `cellSelectionChange` (with the cell count) up to the grid, clear `self._cellDragging`, and unbind the document-level `.wcdv_cell_marquee` handlers.

**(d) Visual highlight.** Apply a scoped class (e.g. `wcdv_selected_cell`) to every `<td>` in the rectangle, clearing it before re-applying on each mousemove. Optionally mark the anchor with `wcdv_selected_cell_anchor`.

**(e) Mutual exclusivity (the requested behavior).** Beginning a cell drag clears the row selection by calling the renderer's unselect-all (`GridTable.prototype.unselect` with no args clears `self.selection` and fires `selectionChange`, so the titlebar count updates — [src/renderers/grid/table.js#L2315](../src/renderers/grid/table.js#L2315)). Conversely, the row checkbox handler ([src/renderers/grid/table/plain.js#L1555](../src/renderers/grid/table/plain.js#L1555)) and `GridTable.prototype.select` ([src/renderers/grid/table.js#L2255](../src/renderers/grid/table.js#L2255)) call `clearCellSelection()`. Only one selection kind is ever non-empty.

**(f) GridTable API.** Add to [src/renderers/grid/table.js](../src/renderers/grid/table.js): `getCellSelection()` returning `{ rowNums, fields, cells }` (delegating to the plain renderer's `self.cellSelection`), `clearCellSelection()`, and forward the `cellSelectionChange` event. These sit alongside `getSelection()` / `select()` / `unselect()` ([table.js#L2178](../src/renderers/grid/table.js#L2178) / [L2255](../src/renderers/grid/table.js#L2255) / [L2315](../src/renderers/grid/table.js#L2315)).

**(g) Teardown / redraw.** Clear the cell selection and unbind any `.wcdv_cell_marquee` document handlers in the plain renderer's `clear()` alongside the existing `keydown.*` cleanup ([src/renderers/grid/table/plain.js#L1577](../src/renderers/grid/table/plain.js#L1577)). Cell selection does not survive a redraw.

### 4. TSV serialization (rows and cells) — `src/renderers/grid/table.js`

Provide two serializers, both emitting TSV via the `Csv` class (already imported at [src/renderers/grid/table.js#L27](../src/renderers/grid/table.js#L27)) configured with a tab separator, rather than hand-rolling escaping:

- `getSelectedDataAsTsv()` (**rows**): determine visible columns and order via `determineColumns(self.colConfig, data, self.typeInfo)` (same call used at [src/renderers/grid/table.js#L1579](../src/renderers/grid/table.js#L1579)), excluding `colConfig.isHidden` columns. Header row uses `colConfig.displayText || field`. Body rows pull from `getSelection().rows` ([table.js#L2178](../src/renderers/grid/table.js#L2178)) for each visible field, in display order, using the displayed value.
- `getSelectedCellsAsTsv()` (**cells**): take the rectangle's `fields` (already visible, display order) and `rowNums` (display order). Emit **only** the spanned cell values — **no header row** — so the output matches exactly what was selected, like copying a range in a spreadsheet. Each spanned row contributes its values for those fields, read via `self.data.dataByRowId[rowNum][field]` using the displayed value (same `.cachedRender`/`.value`/`.orig` precedence the "show full value" path uses at [table.js#L1370](../src/renderers/grid/table.js#L1370)).

### 5. Copy button + `copySelection()` — `src/grid.js`

- Build the copy button in the titlebar next to the export button, following the export-button pattern ([src/grid.js#L1301](../src/grid.js#L1301)). Use `icon('clipboard')` (or `icon('copy')`), set `title` to `trans('GRID.TITLEBAR.COPY_SELECTION_TOOLTIP')`, give it `aria-label = trans('GRID.TITLEBAR.COPY_SELECTION')`, and start it **disabled**. Add the button when **either** `self.features.rowSelect` **or** `self.features.cellSelect` is enabled.
- Enable/disable: listen to **both** `selectionChange` (rows, [src/grid.js#L1547](../src/grid.js#L1547)) **and** the new `cellSelectionChange` (cells). The button is enabled when either selection is non-empty, disabled when both are empty.
- Add `Grid.prototype.copySelection` with this precedence:
  1. If `self.renderer.getCellSelection()` is non-empty → `tsv = self.renderer.getSelectedCellsAsTsv()`; `count` = number of cells; toast key `GRID.TOAST.CELLS_COPIED`.
  2. Else if `self.renderer.getSelection().rows` is non-empty → `tsv = self.renderer.getSelectedDataAsTsv()`; `count` = number of rows; toast key `GRID.TOAST.ROWS_COPIED`.
  3. Else return.
  - If `count` exceeds a threshold (e.g. 10,000), confirm before proceeding (OKR risk mitigation).
  - `writeToClipboard(tsv).then(function () { self.toast.show(trans(toastKey, count)); });` — handle rejection with a recoverable `log.error` (no throw).
  - Lazily create the shared `self.toast` (Toast instance) on first use.

### 6. Keyboard shortcut — `src/renderers/grid/table/plain.js`

Follow the namespaced keydown pattern used by the omnifilter / active-row handlers ([src/renderers/grid/table/plain.js#L100](../src/renderers/grid/table/plain.js#L108)):

- Bind `keydown.copy-selection-<focusEventId>` on `document` when `self.features.rowSelect` or `self.features.cellSelect` is enabled.
- Skip when `evt.target.tagName` is a form element (`A`, `BUTTON`, `INPUT`, `SELECT`, `TEXTAREA`) so normal text copy is never hijacked.
- Only act when `self._hasFocus` is true, the key is `c` with `evt.ctrlKey || evt.metaKey`, **and** **either** the row selection **or** the cell selection is non-empty. Then `evt.preventDefault()` and call `self.grid.copySelection()`.
- When both selections are empty, do **not** preventDefault — let the browser handle copy normally.
- Remove the namespaced handler in the destroy path alongside the existing `keydown.active-row-*` / `keydown.omnifilter-*` cleanup ([src/renderers/grid/table/plain.js#L1577](../src/renderers/grid/table/plain.js#L1577)).

### 7. Internationalization

Add to [en-US.tsv](../en-US.tsv) within the `GRID.TITLEBAR.*` block ([en-US.tsv#L16](../en-US.tsv#L16)) and a new `GRID.TOAST.*` group, and add the **same labels at the matching relative position** in every file under [trans/](../trans/):

| Label | English | Notes |
| --- | --- | --- |
| `GRID.TITLEBAR.COPY_SELECTION` | `Copy Selection` | aria-label for the copy button. |
| `GRID.TITLEBAR.COPY_SELECTION_TOOLTIP` | `Copy the selected rows or cells to the clipboard` | Button tooltip/title. |
| `GRID.TOAST.ROWS_COPIED` | `%d rows copied to clipboard` | `%d` is the row count. |
| `GRID.TOAST.CELLS_COPIED` | `%d cells copied to clipboard` | `%d` is the cell count. |

The `src/lang/*.js` packs are generated by the build — do not hand-edit them.

### 8. CSS wiring

- Add toast styles to [wcdatavis.css](../wcdatavis.css) (scoped `wcdv_toast` class).
- Add cell-marquee highlight styles (scoped `wcdv_selected_cell`, and optionally `wcdv_selected_cell_anchor`) to [wcdatavis.css](../wcdatavis.css). Keep scoped and minimal; no global resets. Ensure the highlight reads clearly against both `even`/`odd` row striping and is visually distinct from the existing `wcdv_selected_row` row highlight.
- If a new SCSS file is introduced for the toast, wire its import into `index.js` and `datavis.js` following the existing UI-component CSS pattern.

## Constraints

- **IE11 compatibility**: `var`, function declarations, `var self = this`; no arrow functions, template strings, destructuring, ES6 classes/modules. The clipboard fallback exists precisely because `navigator.clipboard` is absent in IE11. `document.elementFromPoint`, `Element.closest`, and namespaced jQuery mouse events are all available in IE11 (the grid already uses `closest`/`elementFromPoint`-style logic and namespaced drag events).
- **Secure context**: `navigator.clipboard.writeText` requires HTTPS/localhost and a user gesture; the button click and Ctrl/Cmd+C both satisfy the gesture requirement, and the fallback covers non-secure contexts.
- **System design**: serialization reuses the existing `Csv` class; row selection and column-config are read through existing renderer APIs. The cell rectangle is a new, parallel selection concept that mirrors the existing row-selection API shape (`getCellSelection()` alongside `getSelection()`) and lives entirely in the plain renderer.
- **Mutually exclusive selections**: only one of row selection / cell selection is non-empty at a time; each entry point clears the other.
- **Plain output only**: the marquee is disabled for grouped/pivot output; copying a row selection continues to work in all modes.
- **Redraw clears cell selection**: the rectangle is tied to the currently rendered cells and is cleared on sort/filter/paginate/redraw.
- **Accessibility**: copy button is a real `<button>` with `aria-label`; toast uses `role="status"` + `aria-live="polite"`. (The marquee is a pointer gesture; keyboard-driven cell range selection is out of scope — see below.)
- **Smallest viable change**: new files are limited to `src/util/clipboard.js` and `src/ui/toast.js`; edits are confined to `grid.js`, `table.js`, `plain.js`, the TSV/CSS files.

## Example Page

Reuse [tests/pages/grid/default.html](../tests/pages/grid/default.html) for the row-copy cases (requires `rowSelect`). The marquee requires the new `cellSelect` feature, which no existing page enables — add a small page (e.g. `tests/pages/grid/selection/cell-copy.html`) that enables **both** `rowSelect` and `cellSelect` over plain output, modeled on [tests/pages/grid/vite.html](../tests/pages/grid/vite.html) for JS/CSS includes.

## Tests

New file `tests/selenium/copy-clipboard.js`. Reuse helpers in [tests/lib/grid.js](../tests/lib/grid.js): `selectRow` ([tests/lib/grid.js#L984](../tests/lib/grid.js#L984)), `getSelection` ([tests/lib/grid.js#L1005](../tests/lib/grid.js#L1005)), `getCell` ([tests/lib/grid.js#L1124](../tests/lib/grid.js#L1124)), and `waitForIdle`. Follow the structure of [tests/selenium/selection.js](../tests/selenium/selection.js). Add a `selectCellRange(startColRow, endColRow)` helper that drags via `driver.actions().move({origin: startTd}).press().move({origin: endTd}).release().perform()` (the codebase already uses `driver.actions().move({origin})` for hover in [tests/lib/util.js](../tests/lib/util.js)).

Cover, at minimum:

**Row copy**
- Selecting 3 rows and copying produces TSV with a header row + the 3 selected rows, tab-separated.
- Hidden columns are excluded and column order matches the grid's display order.
- The copy button is disabled with an empty selection and enabled with ≥1 row selected.
- The toast shows the correct row count text and auto-dismisses.

**Cell marquee**
- Dragging from cell (col A, row 0) to (col C, row 2) highlights the 3×3 block and copying produces TSV with the 9 cell values in display order and **no header row** (spreadsheet-style).
- Starting a cell drag **clears a pre-existing row selection** (assert `getSelection()` is empty and the row highlight is gone).
- Ticking a row checkbox **clears a pre-existing cell selection** (assert `getCellSelection()` is empty).
- Ctrl+C / Cmd+C copies the cell rectangle when one exists, and is a no-op when both selections are empty.
- Sorting/filtering/paginating clears the cell selection.

**Reading the clipboard in Selenium** is permission-gated and flaky in headless Chrome. Prefer asserting against the value written — e.g. spy on `writeToClipboard` (capture the last string on a global) or read the hidden-textarea contents — rather than `navigator.clipboard.readText()`. Add a **manual QA** step (OKR KR3): paste both a row copy and a cell-rectangle copy into Excel and Google Sheets and verify column alignment, documented with screenshots in the PR.

Run `npm run lint` and `make test` (or `npm run test --file=copy-clipboard`) before opening the PR.

## Out of Scope

- Rich (HTML) clipboard formatting.
- Pasting into the grid.
- Copying from graph views.
- Marquee cell selection in **grouped/pivot** output (plain output only).
- Keyboard-driven cell-range selection (e.g. Shift+Arrow); the marquee is a pointer gesture.
- Cell selections spanning multiple pages, or persisting a cell selection across a redraw.
