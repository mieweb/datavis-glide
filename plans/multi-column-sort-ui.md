# Plan: Multi-Column Sort — GLIDE UI

This is the **user-interface half** of the Multi-Column Sort feature (DataVis Q2 2026 OKR 1). It covers only the changes in the DataVis GLIDE repository (the Graphical Layer for Interactive Data Exploration). The engine half — the sort-spec array, chained comparison, and stable sort — lives in the DataVis ACE package and is tracked separately in `datavis-ace/plans/multi-column-sort-engine.md`.

> **Prerequisite:** This work depends on the ACE engine accepting an **array** of sort specs per orientation (`sortSpec.vertical` / `sortSpec.horizontal`). Land the ACE change and bump the `datavis-ace` dependency in [package.json](../package.json#L48) (currently `=4.0.0-PRE.2`) before merging this UI work.

## Background

Sorting UI is built per column header in [src/renderers/grid/table.js](../src/renderers/grid/table.js#L799) by `GridTable.prototype._addSortingToHeader`. Today a click opens a `PopupMenu` whose items call an inner `setSort(dir, aggNum)` that **replaces** the orientation's spec:

```javascript
var sortSpec = self.view.getSort() || {};
sortSpec[orientation] = deepCopy(spec);
self.view.setSort(sortSpec, self.makeProgress('Sort'));
```

(See [src/renderers/grid/table.js#L894](../src/renderers/grid/table.js#L894).)

The goal is to let users build a compound sort of any number of columns directly from the existing sort menu. Each menu row gains a trailing **add** button (a plus icon): clicking it **appends** that column to the sort chain, while clicking anywhere else in the row still **replaces** the sort exactly as it does today. Sorted columns show numbered priority badges. There is no fixed cap on the number of sort columns.

## Customer-facing behavior

1. **Single-click** a column's sort icon → opens the sort menu (today's behavior).
2. **Click a menu row** (anywhere except the add button) → sets a single-column sort for that column/direction, replacing any existing sort (today's behavior).
3. **Click the row's add button** (a plus icon floating at the right of the row) → **adds** that column/direction to the sort chain. A numbered badge (1, 2, 3…) appears on each sorted column indicating priority.
4. Clicking the add button for a column already in the chain updates its direction to the one just chosen (no duplicate entries).
5. **Reset Sort** clears the entire chain (`view.clearSort()`).
6. Compound sorts work in plain, group, and pivot output modes (the engine handles the orientation-specific spec shapes; the UI just appends spec elements).
7. There is no fixed cap on the number of sort columns; the chain may be as long as the user wants (sorting by every column is allowed, if pointless).

## Implementation Steps

### 1. Additive `setSort` — `_addSortingToHeader`

In the inner `setSort` helper ([src/renderers/grid/table.js#L871](../src/renderers/grid/table.js#L871)):

- Add an `additive` parameter (true when the row's add button was clicked, false when the row body was clicked).
- **Replace mode** (`additive` false): set `sortSpec[orientation] = [deepCopy(spec)]` — a single-element array (today's behavior, new shape).
- **Additive mode** (`additive` true):
  - Read the existing array (`self.view.getSort()[orientation]`, defaulting to `[]`).
  - Find an element matching this column (by `field` / `groupFieldIndex` / `pivotFieldIndex` / `aggNum` as appropriate).
  - **Not present** → append `deepCopy(spec)` with the chosen `dir`.
  - **Present** → update that element's `dir` to the chosen direction (no duplicate entries).
  - Call `self.view.setSort(sortSpec, self.makeProgress('Sort'))`.
- Do not impose a maximum chain length; the chain may grow to as many columns as the user adds.

### 2. Per-row add button — sort menu items

- Render each sort menu row with a trailing **add** button (a `plus` icon) floating to the right of the row's label, as a real `<button>` with an `aria-label` from `trans('GRID.TABLE.SORT_MENU.ADD_TO_SORT')`.
- Clicking the add button runs `setSort(dir, aggNum, /*additive*/ true)` and **stops propagation** so the row's own (replace) handler does not also fire.
- Clicking anywhere else in the row runs `setSort(dir, aggNum, /*additive*/ false)` (replace), exactly as today.
- This requires the `PopupMenu` item to support a trailing action control; if it does not already, extend it minimally to render an optional per-item button without disturbing the row's primary click target.

### 3. Sort menu structure — `PopupMenu`

In the menu-building block ([src/renderers/grid/table.js#L905](../src/renderers/grid/table.js#L905)):

- Keep the existing `GRID.TABLE.SORT_MENU.ASCENDING` / `DESCENDING` rows (and the aggregate-sort variants) as the row labels; the row body click still calls `setSort(dir)` in replace mode.
- Give each of those rows the trailing add button from step 2 (calls `setSort(dir, aggNum, /*additive*/ true)`); there are no separate "Add to Sort" rows.
- Keep `GRID.TABLE.SORT_MENU.RESET_SORT` → `self.view.clearSort()` (clears whole chain).
- Use the same icons already in use (`arrow-up-narrow-wide`, `arrow-down-wide-narrow`, `ban`) for the row labels, and `plus` for the add button.

### 4. Numbered priority badges — `replaceSortIndicator` + sync

- Extend `replaceSortIndicator(span, dir)` ([src/renderers/grid/table.js#L822](../src/renderers/grid/table.js#L822)) to accept a priority number and, when the column is part of a multi-column chain, render a small numbered badge on the header next to the direction arrow.
- Give the badge an accessible label via `trans('GRID.TABLE.SORT_MENU.PRIORITY_BADGE', n)` (e.g. rendered as `aria-label` on the badge element).
- Update the indicator-sync block ([src/renderers/grid/table.js#L982](../src/renderers/grid/table.js#L982)) to iterate the spec **array** for the orientation and light up every sorted column with its direction arrow and its 1-based priority badge. A single-element chain shows the arrow with no badge (or badge "1" — choose one and apply consistently).

### 5. Badge styling — `wcdatavis.css`

- Add a scoped, semantically named class (e.g. `wcdv_sort_priority_badge`) for the numbered badge: small, high-contrast, positioned on the sorted `th`. Keep styles minimal and scoped; no global resets.

### 6. Internationalization

Add the following labels to [en-US.tsv](../en-US.tsv) near the existing sort-menu labels (`GRID.TABLE.SORT_MENU.ASCENDING` / `DESCENDING` / `RESET_SORT`), and add the **same labels at the matching relative position** in every file under [trans/](../trans/):

| Label | English | Notes |
| --- | --- | --- |
| `GRID.TABLE.SORT_MENU.ADD_TO_SORT` | `Add to Sort` | aria-label for the per-row add (plus) button. |
| `GRID.TABLE.SORT_MENU.PRIORITY_BADGE` | `Sort priority %d` | aria-label for the numbered badge. |

The `src/lang/*.js` packs are generated automatically by the build — do not hand-edit them.

## Constraints

- **IE11 compatibility**: `var`, function declarations, `var self = this`; no arrow functions, template strings, destructuring, ES6 classes/modules. `table.js` already mixes DOM and jQuery — follow the surrounding style.
- **System design**: do not bypass the view layer. All sort changes go through `view.setSort` / `view.clearSort`. The UI only constructs the spec array; the engine sorts.
- **Smallest viable change**: confine UI changes to `_addSortingToHeader` (plus a minimal per-item add-button affordance in `PopupMenu`), the badge CSS, and the new i18n labels.
- **Accessibility**: badges carry `aria-label`; sort icon buttons remain real `<button>` elements with discernible labels.

## Example Page

Reuse existing sorting pages under [tests/pages/grid/sorting/](../tests/pages/grid/sorting/) and [tests/pages/grid/default.html](../tests/pages/grid/default.html), which already expose multiple typed columns and the plain/group/pivot modes. Add a dedicated `tests/pages/grid/sorting/multi-column.html` **only if** no existing page provides enough columns and output modes to exercise a 3+ column compound sort. Follow `tests/pages/grid/vite.html` for including JS and CSS.

## Tests

New file `tests/selenium/multi-sort.js`. Reuse helpers in [tests/lib/grid.js](../tests/lib/grid.js): `sortByField` ([tests/lib/grid.js#L452](../tests/lib/grid.js#L452)), `sortByAgg` ([tests/lib/grid.js#L463](../tests/lib/grid.js#L463)), `clickActiveSortMenu`, and `waitForIdle`. Add an `addSortByField(field, dir)` helper that opens the column's sort menu and clicks the matching row's add (plus) button, plus a helper to read a column header's priority badge.

Cover, at minimum:

- Compound sort of several columns (3+) produces correct row order in **plain**, **group**, and **pivot** modes.
- Numbered priority badges (1, 2, 3…) render on each sorted header with correct `aria-label` text for a 3-column sort.
- Clicking a menu row replaces the sort; clicking its add button appends to the chain.
- Clicking the add button for a column already in the chain updates its direction instead of duplicating it.
- "Reset Sort" clears the entire chain.
- Multi-column sort round-trips through perspective save/load (`localStorage`) with identical row order after reload.
- **Regression — cross-output-mode priority badges**: a single-column sort shows **no** priority badge in any output mode (including a lone aggregate/Count sort in group **summary** mode); badges appear only once 2+ columns are in the chain and are numbered correctly within the current output mode (e.g. grouping by Fruit then adding a Count sort yields Fruit = 1, Count = 2, not a stray badge carried over from another mode).
- **Regression — removing a grouped column with a stale sort spec**: with a chain that mixes a plain-column sort and a group-field sort (e.g. sort by Country, group by Fruit, switch to summary mode, sort by Fruit), clicking the group field's **Remove** button (`div.wcdv_field button[title="Remove"]`) must **not** crash the grid. The grid refreshes back to plain output, the now-inapplicable group-field sort spec is silently skipped, and the remaining applicable sort (Country, ascending) is preserved with correct row order. (Engine fix lives in `datavis-ace` `ComputedView.performSort`; this case guards against the UI ever leaving a stale spec that aborts the refresh.)
- **Backward compatibility**: all existing cases in [tests/selenium/sort.js](../tests/selenium/sort.js) pass **without modification**.

Run `npm run lint` and `make test` (or `npm run test --file=multi-sort`) before opening the PR.

## Out of Scope

- Drag-to-reorder sort priority.
- A dedicated sort-builder dialog.
- Any engine/comparison/stability work — see `datavis-ace/plans/multi-column-sort-engine.md`.
