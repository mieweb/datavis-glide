# Plan: Replace FontAwesome with Lucide

## TL;DR

Replace FontAwesome with Lucide icons across the entire DataVis GLIDE codebase. The core change is rewriting the `fontAwesome()` utility in `src/util/misc.js` to produce Lucide SVG elements, then updating CSS selectors, simplifying FA-specific branching logic, and updating tests. Sort icon stacking (overlaid ascending+descending arrows with highlighting) is replaced with a simpler single-icon approach that swaps between ascending and descending icons.

## Phases

### Phase 1: Core Infrastructure

**Step 1: Add Lucide dependency**
- Add `lucide` (or `lucide-static`) to `package.json`
- No FA dependency exists in package.json (FA is loaded externally via CSS)

**Step 2: Build icon name mapping**
- Create a mapping object from FA names (e.g. `fa-check`) to Lucide names (e.g. `check`)
- Full mapping listed below in the Icon Mapping section

**Step 3: Rewrite `fontAwesome()` in `src/util/misc.js` (line 256)**
- Replace the `<span class="fa fa-xxx">` creation with Lucide SVG element creation
- Keep the same signature: `fontAwesome(icon, cls, title)` (or rename to `lucideIcon` with `fontAwesome` as alias)
- Add a `wcdv_icon` class to all produced SVG elements for CSS targeting
- Add a `data-icon` attribute with the Lucide icon name for test identification
- Map `fa-spin` / `fa-pulse` CSS classes to `wcdv_icon_spin` / `wcdv_icon_pulse`
- Map `fa-rotate-*` classes to `wcdv_icon_rotate_*`
- Remove the hex charcode branch (webfont mode)

**Step 4: Update `showValueSpan` in `src/util/misc.js` (line 448)**
- Replace `span.fa.fa-asterisk` raw DOM creation with Lucide SVG equivalent

**Step 5: Update `makeOperationButton()` in `src/util/misc.js` (line 555-577)**
- Check `op.iconType` to determine how to render the icon:
  - If `op.iconType === 'fontawesome'`: render using the old FontAwesome `<span class="fa">` approach (preserves backward compatibility for external consumers)
  - Otherwise (default): treat `op.icon` as a Lucide icon name and render via the new Lucide icon function
- The icon creation function (formerly `fontAwesome()`) should accept an optional `iconType` parameter or the caller (`makeOperationButton`) should branch before calling it
- Internal DataVis operations should all use Lucide names going forward

### Phase 2: jQuery Plugin

**Step 6: Simplify `_makeIconCheckbox()` in `src/util/jquery.js` (line 150-250)**
- Remove all `flags['FontAwesome Method'] === 'svg'` branches (3 occurrences)
- Remove the `setTimeout` workaround for FA SVG replacement
- Keep direct show/hide of icon elements (works natively with Lucide SVGs)
- Remove ID-based element lookup via `document.getElementById` (no longer needed)

### Phase 3: Sort Icons (Simplified)

**Step 7: Replace sort icon stacking with simple icon switch in `src/renderers/grid/table.js` (lines 790-960)**

Current behavior: Two arrows (ascending + descending) are overlaid via FA stacking (`fa-stack` / `fa-layers`). When a sort direction is active, one arrow gets `wcdv_sort_arrow_active` (white) and the other gets `wcdv_sort_arrow_inactive` (hidden). When no sort is active, both arrows are visible (dimmed).

New behavior: A single sort icon container holds one Lucide icon at a time.
- **No sort active**: Show a neutral `arrow-up-down` icon (indicates sortable)
- **Ascending**: Show `arrow-up` icon
- **Descending**: Show `arrow-down` icon

Changes to `_addSortingToHeader`:
- Remove `ascArrow` / `descArrow` dual-element construction
- Remove both `flags['FontAwesome Method']` branches (font vs. svg)
- Create a single `sortIcon_span` container with class `wcdv_sort_icon` and the generated `sortIcon_class`
- Place one Lucide `arrow-up-down` icon inside it initially
- For horizontal orientation, apply `wcdv_icon_rotate_270` class instead of `fa-rotate-270`

Changes to `replaceSortIndicator`:
- Instead of iterating children and toggling `wcdv_sort_arrow_active`/`wcdv_sort_arrow_inactive`, simply replace the icon content:
  - `dir == null` -> show `arrow-up-down` icon
  - `dir === 'ASC'` -> show `arrow-up` icon
  - `dir === 'DESC'` -> show `arrow-down` icon
- Still handle `th` class toggling (`wcdv_sort_column_active`, `wcdv_bg-primary`) as before

Changes to `setSort`:
- Update the jQuery selector from `'span.' + sortIcon_orientationClass + '.fa-stack'` to `'span.' + sortIcon_orientationClass + '.wcdv_sort_icon'` (or just use `wcdv_sort_icon` class)

Changes to `makeIcon`:
- Remove `flags['FontAwesome Method']` branching
- Always return a function that creates Lucide SVG (for context menu icons)
- Update icon names: `fa-sort-amount-asc` -> `arrow-up-narrow-wide`, `fa-sort-amount-desc` -> `arrow-down-wide-narrow`

**Step 8: Remove `fa-stack` / `fa-layers` / `fa-stack-1x` CSS rules from `wcdatavis.css` (line 1258)**

### Phase 4: CSS Updates

**Step 9: Update `wcdatavis.css` icon selectors (lines 56-130)**
- Replace all `span.fa` selectors with `svg.wcdv_icon`
- Replace all `svg.svg-inline--fa` selectors with `svg.wcdv_icon`
- Collapse duplicate selector pairs (font + svg) into single selectors
- Change `font-size` properties to `width` + `height` for SVG sizing
- Remove `.wcdv_grid th .fa:hover` rules (line ~1250)
- Remove `.fa-stack` rules (line ~1258)

**Step 10: Add new utility CSS classes**
- `.wcdv_icon_spin` -- continuous rotation animation
- `.wcdv_icon_pulse` -- stepped rotation animation
- `.wcdv_icon_rotate_180` -- transform: rotate(180deg)
- `.wcdv_icon_rotate_270` -- transform: rotate(270deg)
- Remove `wcdv_sort_arrow_active` and `wcdv_sort_arrow_inactive` (no longer needed)

### Phase 5: Consumer Code (call sites)

**Step 11: Update all source files that call `fontAwesome()`**
- Update FA icon name strings to Lucide names (or rely on mapping)
- Files: `src/grid.js`, `src/graph.js`, `src/grid_control.js`, `src/operations_palette.js`, `src/ui/grid_filter.js`, `src/ui/windows/debug.js`, `src/ui/windows/col_config.js`, `src/ui/toolbars/grid.js`, `src/renderers/grid/table/plain.js`, `src/renderers/grid/table/group_detail.js`, `src/renderers/grid/table.js`

**Step 12: Replace direct FA class manipulation**
- `src/grid.js` lines 1832/1863 and `src/graph.js` lines 848/877: Replace `fa-rotate-180` with `wcdv_icon_rotate_180`
- `src/grid.js` lines 1538/2217/2223: Replace `children('span.fa, svg.svg-inline--fa')` with `children('svg.wcdv_icon')`

### Phase 6: Flags Cleanup

**Step 13: Remove FA flags from `src/flags.js`**
- Delete `'FontAwesome Version'` and `'FontAwesome Method'` entries
- Remove all `flags['FontAwesome Version']` and `flags['FontAwesome Method']` checks throughout the codebase

### Phase 7: Test Infrastructure

**Step 14: Update `tests/lib/grid.js` icon detection (lines 1057-1075)**
- In `getOperations()`, replace `getClass(btn.findElement(By.css('span')), /fa-/)` with reading `data-icon` attribute from `svg.wcdv_icon`

**Step 15: Update `tests/selenium/operations.js` expected values (lines 28-29)**
- Change FA icon names to Lucide icon names in assertions

**Step 16: Update test page HTML files**
- Remove `<link rel="stylesheet" href="...font-awesome.css"/>` from all test pages
- Add Lucide initialization if needed (may not be needed if bundled into JS)

**Step 17: Remove FA assets from `tests/pages/`**
- Remove `tests/pages/font-awesome.css`
- Remove `tests/pages/fontawesome-webfont.svg` and any other FA font files

### Phase 8: Documentation & Config

**Step 18: Update `meteor.js`**
- Remove `flags['FontAwesome Version'] = 6` and `flags['FontAwesome Method'] = 'svg'`

**Step 19: Update `README.md`**
- Replace FontAwesome 4.7 CDN reference with Lucide setup instructions

**Step 20: Address context menu plugin**
- `jquery.contextMenu` uses FA icon classes (`context-menu-icon--fa`)
- Need to either: configure the plugin's icon renderer for Lucide, or provide a CSS shim
- The `makeIcon` function in `table.js` already uses a callback approach for SVG mode; this pattern can be kept for Lucide

## Icon Mapping

| FontAwesome | Lucide |
|---|---|
| fa-check | check |
| fa-ban | ban |
| fa-times | x |
| fa-search | search |
| fa-refresh | refresh-cw |
| fa-cog / fa-gear | settings |
| fa-chevron-down | chevron-down |
| fa-download | download |
| fa-pencil | pencil |
| fa-pencil-square-o | square-pen |
| fa-bug | bug |
| fa-question-circle | circle-help |
| fa-info-circle | info |
| fa-minus-square | square-minus |
| fa-exclamation-triangle | triangle-alert |
| fa-bolt | zap |
| fa-eye | eye |
| fa-eye-slash | eye-off |
| fa-long-arrow-right | arrow-right |
| fa-spinner / fa-circle-o-notch | loader-circle |
| fa-file-o | file |
| fa-bars | menu |
| fa-angle-double-up | chevrons-up |
| fa-angle-double-down | chevrons-down |
| fa-undo | undo-2 |
| fa-thumb-tack | pin |
| fa-code | code |
| fa-paint-brush | paintbrush |
| fa-columns | columns-3 |
| fa-arrows-h | move-horizontal |
| fa-chevron-circle-left | circle-chevron-left |
| fa-chevron-circle-right | circle-chevron-right |
| fa-clock-o | clock |
| fa-save | save |
| fa-trash | trash-2 |
| fa-table | table |
| fa-filter | filter |
| fa-sort-asc | arrow-up |
| fa-sort-desc | arrow-down |
| fa-sort-amount-asc | arrow-up-narrow-wide |
| fa-sort-amount-desc | arrow-down-wide-narrow |
| fa-arrows-v | move-vertical |
| fa-chevron-circle-down | circle-chevron-down |
| fa-minus-square-o | square-minus |
| fa-plus-square-o | square-plus |
| fa-square-o | square |
| fa-thumbs-up / fa-thumbs-o-up | thumbs-up |
| fa-thumbs-o-down | thumbs-down |
| fa-battery-0 | battery |
| fa-battery-1 | battery-low |
| fa-battery-2 | battery-medium |
| fa-battery-3 | battery-full |
| fa-battery-4 | battery-charging |
| fa-asterisk | asterisk |
| fa-stack | (removed -- no longer needed) |

New icon (not an FA replacement):
- `arrow-up-down` -- used for neutral sort indicator (no active sort)

## Relevant Files

- `src/util/misc.js` -- rewrite `fontAwesome()` (line 256), update `showValueSpan` (line 448), update `makeOperationButton` (line 555)
- `src/util/jquery.js` -- simplify `_makeIconCheckbox()` (line 150), remove FA method checks
- `src/flags.js` -- remove FA flags
- `src/renderers/grid/table.js` -- replace sort icon stacking with simple icon switch (lines 790-960)
- `wcdatavis.css` -- update all `span.fa` / `svg.svg-inline--fa` selectors, remove FA-specific rules
- `tests/lib/grid.js` -- update `getOperations()` icon detection (line 1057)
- `tests/selenium/operations.js` -- update expected icon names (line 28)
- `tests/pages/font-awesome.css` -- remove
- All test page HTML files -- remove FA CSS links
- `meteor.js` -- remove FA flag overrides
- `README.md` -- update setup instructions
- All `src/` files importing `fontAwesome` -- update icon name strings

## Verification

1. `npm run lint` -- ensure no lint errors after changes
2. `make test` -- run full Selenium test suite
3. `npm run test --file=operations` -- specifically verify operations icon identification still works
4. `npm run test --file=sort` -- verify sort behavior with new single-icon approach
5. Manual visual inspection -- check sort icons show `arrow-up-down` (neutral), `arrow-up` (asc), `arrow-down` (desc)
6. Manual check of spinner animations -- verify `wcdv_icon_spin` and `wcdv_icon_pulse` animate correctly
7. Manual check of context menu icons -- verify sort menu items still show icons
8. Verify no remaining references to FA: `grep -r "fa-\|fontAwesome\|font-awesome\|svg-inline--fa\|FontAwesome" src/ wcdatavis.css tests/lib/ tests/selenium/`

## Decisions

- The `fontAwesome()` function name can be kept as-is or renamed to `lucideIcon()` with an alias. Keeping the name avoids touching every import but is misleading. Recommendation: rename to `makeIcon` or `icon` and update imports.
- Sort icons change from stacked arrows to single-icon swap (`arrow-up-down` -> `arrow-up` / `arrow-down`)
- Operations API: external consumers can continue using FontAwesome icons by setting `op.iconType = 'fontawesome'` on their operation config; without `iconType`, icons are assumed to be Lucide names
- `wcdv_sort_arrow_active` / `wcdv_sort_arrow_inactive` CSS classes are removed (no longer needed with icon-swap approach)
- The `fa-stack` / `fa-layers` / `fa-stack-1x` concepts are eliminated entirely

## Further Considerations

1. **Context menu plugin**: `jquery.contextMenu` has built-in FA support. The current SVG-mode workaround in `makeIcon` uses a callback that creates elements -- this approach works for Lucide too, but the plugin's `context-menu-icon--fa` CSS class may need attention.
2. **External consumers**: Any code outside this repo that passes `fa-xxx` icon names via the operations API can set `op.iconType = 'fontawesome'` to keep using FA icons without changes. This requires that the host page still loads FontAwesome CSS/fonts. Without `iconType`, icon names are treated as Lucide.
3. **Tree-shaking**: Lucide supports tree-shaking by importing individual icons. Consider whether to import the entire library or just the icons used, to minimize bundle size.

## Execution Notes

### Completed

All phases 1-8 have been executed. Key implementation details:

- **Lucide API**: `lucide` v1.8.0 exports an `icons` object with PascalCase keys. Each icon's data is an array of `[tagName, attributes]` tuples. SVGs are built manually via `document.createElementNS` since Lucide's `createElement` requires `document` as argument.
- **FA name mapping preserved**: All `fontAwesome('fa-xxx')` calls in consumer code continue to work through the `faToLucideMap` in misc.js. No need to update every call site.
- **ESLint**: The computed namespace access `lucideIcons[pascalName]` triggers `import/namespace` -- suppressed with inline disable comment. `hasOwnProperty` call fixed to use `Object.prototype.hasOwnProperty.call()`.
- **jQuery selectors**: Three `children('span.fa, svg.svg-inline--fa')` calls in grid.js updated to `children('svg.wcdv_icon')`.
- **showHideButton rotation**: `fa-rotate-180` was applied to the button element but the icon is a child SVG. Changed to `children('svg.wcdv_icon').addClass/removeClass('wcdv_icon_rotate_180')`.
- **Context menu CSS**: `context-menu-icon--fa` rules left as-is -- they're jQuery contextMenu plugin styling, not our icons.
- **Test pages**: FA CSS links removed from all ~110 HTML files via `sed`.
- **`tests/pages/font-awesome.css`**: Still exists on disk; should be deleted separately (destructive action).

### Remaining Work

- **Delete `tests/pages/font-awesome.css`** and any FA font files (pending user confirmation for destructive action)
- **Run `make test`** to verify full Selenium test suite passes
- **Visual inspection** of sort icons, spinners, and icon rendering in browser
- **Bundle size check** -- consider tree-shaking individual Lucide icons if bundle size is a concern