# Plan: Multi-Column Sort — GLIDE UI

This is the **user-interface half** of the Multi-Column Sort feature (DataVis Q2 2026 OKR 1). It
covers only the changes in the DataVis GLIDE repository (the Graphical Layer for Interactive Data
Exploration). The engine half — the sort-spec array, chained comparison, and stable sort — lives in
the DataVis ACE package and is tracked separately in
`datavis-ace/plans/multi-column-sort-engine.md`.

> **Prerequisite:** This work depends on the ACE engine accepting an **array** of sort specs per
> orientation (`sortSpec.vertical` / `sortSpec.horizontal`). Land the ACE change and bump the
> `datavis-ace` dependency in [package.json](../package.json#L48) (currently `=4.0.0-PRE.2`) before
> merging this UI work.

## Background

Sorting UI is built per column header in
[src/renderers/grid/table.js](../src/renderers/grid/table.js#L799) by
`GridTable.prototype._addSortingToHeader`. Today a click opens a `PopupMenu` whose items call an
inner `setSort(dir, aggNum)` that **replaces** the orientation's spec:

```javascript
var sortSpec = self.view.getSort() || {};
sortSpec[orientation] = deepCopy(spec);
self.view.setSort(sortSpec, self.makeProgress('Sort'));
```

(See [src/renderers/grid/table.js#L894](../src/renderers/grid/table.js#L894).)

The goal is to let users build a compound sort of up to **5 columns** via shift-click, show numbered
priority badges on each sorted column, add "Add to Sort" menu entries, and keep single-click behaving
exactly as it does today.

## Customer-facing behavior

1. **Single-click** a column's sort icon → opens the menu; choosing Ascending/Descending sets a
   single-column sort, replacing any existing sort (today's behavior).
2. **Shift-click** a sort icon → **adds** that column to the sort chain. A numbered badge (1, 2,
   3…) appears on each sorted column indicating priority.
3. **Shift-click an already-sorted column** → cycles its direction: ASC → DESC → removed from chain.
4. The context menu gains **"Add to Sort (Ascending)"** / **"Add to Sort (Descending)"** alongside
   the existing Ascending / Descending / Reset Sort.
5. **Reset Sort** clears the entire chain (`view.clearSort()`).
6. Compound sorts work in plain, group, and pivot output modes (the engine handles the
   orientation-specific spec shapes; the UI just appends spec elements).
7. The chain is capped at 5 columns in the UI; attempting to add a 6th is a no-op (optionally with a
   brief status message).

## Implementation Steps

### 1. Additive `setSort` — `_addSortingToHeader`

In the inner `setSort` helper
([src/renderers/grid/table.js#L871](../src/renderers/grid/table.js#L871)):

- Add an `additive` parameter (driven by `evt.shiftKey`).
- **Replace mode** (`additive` false): set `sortSpec[orientation] = [deepCopy(spec)]` — a
  single-element array (today's behavior, new shape).
- **Additive mode** (`additive` true):
  - Read the existing array (`self.view.getSort()[orientation]`, defaulting to `[]`).
  - Find an element matching this column (by `field` / `groupFieldIndex` / `pivotFieldIndex` /
    `aggNum` as appropriate).
  - **Not present** → append `deepCopy(spec)` with the chosen `dir` (no-op if length already 5).
  - **Present** → cycle: ASC → set DESC; DESC → remove the element from the array.
  - Call `self.view.setSort(sortSpec, self.makeProgress('Sort'))`.

### 2. Pass shift state from the click — sort icon + menu

- The sort icon button click handler
  ([src/renderers/grid/table.js#L966](../src/renderers/grid/table.js#L966)) opens the menu. Capture
  `evt.shiftKey` at open time so menu selections know whether to add or replace, **or** add explicit
  "Add to Sort" items (below) that always run additive — the latter is clearer and keeps single-click
  menu entries unambiguous.

### 3. Context-menu additions — `PopupMenu`

In the menu-building block
([src/renderers/grid/table.js#L905](../src/renderers/grid/table.js#L905)):

- Keep existing `GRID.TABLE.SORT_MENU.ASCENDING` / `DESCENDING` items (call `setSort(dir)` in replace
  mode).
- Add `GRID.TABLE.SORT_MENU.ADD_TO_SORT_ASCENDING` / `ADD_TO_SORT_DESCENDING` items that call
  `setSort(dir, aggNum, /*additive*/ true)`.
- When a column is already in the chain, optionally show
  `GRID.TABLE.SORT_MENU.REMOVE_FROM_SORT` instead of/along with the add items.
- Keep `GRID.TABLE.SORT_MENU.RESET_SORT` → `self.view.clearSort()` (clears whole chain).
- Use the same icons already in use (`arrow-up-narrow-wide`, `arrow-down-wide-narrow`, `ban`).

### 4. Numbered priority badges — `replaceSortIndicator` + sync

- Extend `replaceSortIndicator(span, dir)`
  ([src/renderers/grid/table.js#L822](../src/renderers/grid/table.js#L822)) to accept a priority
  number and, when the column is part of a multi-column chain, render a small numbered badge on the
  header next to the direction arrow.
- Give the badge an accessible label via `trans('GRID.TABLE.SORT_MENU.PRIORITY_BADGE', n)` (e.g.
  rendered as `aria-label` on the badge element).
- Update the indicator-sync block
  ([src/renderers/grid/table.js#L982](../src/renderers/grid/table.js#L982)) to iterate the spec
  **array** for the orientation and light up every sorted column with its direction arrow and its
  1-based priority badge. A single-element chain shows the arrow with no badge (or badge "1" — choose
  one and apply consistently).

### 5. Badge styling — `wcdatavis.css`

- Add a scoped, semantically named class (e.g. `wcdv_sort_priority_badge`) for the numbered badge:
  small, high-contrast, positioned on the sorted `th`. Keep styles minimal and scoped; no global
  resets.

### 6. Internationalization

Add the following labels to [en-US.tsv](../en-US.tsv) near the existing sort-menu labels
(`GRID.TABLE.SORT_MENU.ASCENDING` / `DESCENDING` / `RESET_SORT`), and add the **same labels at the
matching relative position** in every file under [trans/](../trans/):

| Label | English | Notes |
| --- | --- | --- |
| `GRID.TABLE.SORT_MENU.ADD_TO_SORT_ASCENDING` | `Add to Sort: %s, Ascending` | `%s` is the column name. |
| `GRID.TABLE.SORT_MENU.ADD_TO_SORT_DESCENDING` | `Add to Sort: %s, Descending` | `%s` is the column name. |
| `GRID.TABLE.SORT_MENU.REMOVE_FROM_SORT` | `Remove from Sort: %s` | `%s` is the column name. |
| `GRID.TABLE.SORT_MENU.PRIORITY_BADGE` | `Sort priority %d` | aria-label for the numbered badge. |

The `src/lang/*.js` packs are generated automatically by the build — do not hand-edit them.

## Constraints

- **IE11 compatibility**: `var`, function declarations, `var self = this`; no arrow functions,
  template strings, destructuring, ES6 classes/modules. `table.js` already mixes DOM and jQuery —
  follow the surrounding style.
- **System design**: do not bypass the view layer. All sort changes go through
  `view.setSort` / `view.clearSort`. The UI only constructs the spec array; the engine sorts.
- **Smallest viable change**: confine UI changes to `_addSortingToHeader`, the badge CSS, and the new
  i18n labels.
- **Accessibility**: badges carry `aria-label`; sort icon buttons remain real `<button>` elements
  with discernible labels.

## Example Page

Reuse existing sorting pages under [tests/pages/grid/sorting/](../tests/pages/grid/sorting/) and
[tests/pages/grid/default.html](../tests/pages/grid/default.html), which already expose multiple
typed columns and the plain/group/pivot modes. Add a dedicated
`tests/pages/grid/sorting/multi-column.html` **only if** no existing page provides enough columns and
output modes to exercise a 3+ column compound sort. Follow `tests/pages/grid/vite.html` for including
JS and CSS.

## Tests

New file `tests/selenium/multi-sort.js`. Reuse helpers in
[tests/lib/grid.js](../tests/lib/grid.js): `sortByField`
([tests/lib/grid.js#L452](../tests/lib/grid.js#L452)), `sortByAgg`
([tests/lib/grid.js#L463](../tests/lib/grid.js#L463)), `clickActiveSortMenu`, and `waitForIdle`. Add
a `shiftSortByField(field, dir)` helper that shift-clicks the sort icon (or invokes the
"Add to Sort" menu item) and a helper to read a column header's priority badge.

Cover, at minimum:

- Compound sort of up to 5 columns produces correct row order in **plain**, **group**, and **pivot**
  modes.
- Numbered priority badges (1, 2, 3…) render on each sorted header with correct `aria-label` text for
  a 3-column sort.
- Shift-click cycles a column ASC → DESC → removed.
- "Reset Sort" clears the entire chain.
- Multi-column sort round-trips through perspective save/load (`localStorage`) with identical row
  order after reload.
- **Backward compatibility**: all existing cases in
  [tests/selenium/sort.js](../tests/selenium/sort.js) pass **without modification**.

Run `npm run lint` and `make test` (or `npm run test --file=multi-sort`) before opening the PR.

## Out of Scope

- Drag-to-reorder sort priority.
- A dedicated sort-builder dialog.
- Any engine/comparison/stability work — see `datavis-ace/plans/multi-column-sort-engine.md`.
