# Plan: Replace jQuery contextMenu with PopupMenu Widget

Replace the `jquery-contextmenu` plugin (v2.10.1) with a custom `PopupMenu` widget class following DataVis conventions (`makeSubclass`, `var self = this`, no ES6, semantic SCSS).

## Phase 1: Create the PopupMenu widget

Create `src/ui/popup_menu.js` using `makeSubclass('PopupMenu', Object, ...)`:

- **Constructor**: `self.items = []`, `self.ui = {}`, `self._boundClose = null`
- **`addItem(label, icon, callback, userdata)`**: Push `{label, icon, callback, userdata}` onto `self.items`. `icon` is a Lucide icon name string.
- **`addSeparator()`**: Push a separator sentinel `{separator: true}` onto `self.items`.
- **`open(anchorElement)`**: Build DOM, append to `document.body`, position near `anchorElement` (if provided) with viewport clamping. Attach `mousedown` listener on `document` to close on outside clicks.
- **`close()`**: Remove DOM from page, detach outside-click listener.
- **`destroy()`**: Call `close()`, null out items and references.

DOM structure produced by `open()`:

```
div.wcdv-popup-menu
  div.wcdv-popup-menu-item   (per item: icon SVG + span.wcdv-popup-menu-item-label)
  div.wcdv-popup-menu-sep    (per separator)
```

Item click handler: calls `close()`, then `callback(userdata)`.

## Phase 2: Create PopupMenu SCSS

Create `src/ui/popup_menu.scss` — compact style:

- Auto-width, small padding (~4px 8px per item), compact line-height
- Hover background `#f0f0f5`, icon color `#0095D6` (matching existing theme)
- Subtle box-shadow, white background, `z-index: 10000`
- Icon 16px inline with label text
- Thin 1px separator line

## Phase 3: Wire CSS into build

- `index.js` — add `import './src/ui/popup_menu.scss';`
- `datavis.js` — add `import './src/ui/popup_menu.scss';`

Both Vite and Rollup+PostCSS will process the SCSS import.

## Phase 4: Update table.js to use PopupMenu

In `src/renderers/grid/table.js`:

1. **Import** `PopupMenu` from `'../../ui/popup_menu.js'`
2. **Constructor** (~line 187): Replace `self.contextMenuSelectors = []` with `self.popupMenus = []`
3. **Menu creation** (~lines 915-1020): Replace `jQuery.contextMenu({...})` with:
   - `var menu = new PopupMenu()`
   - Loop over `sortIcon_menu_items`, call `menu.addItem(item.name, item.icon, item.callback)` for real items and `menu.addSeparator()` for `'----'` entries
   - The `makeMenuIcon` function simplifies to just passing the icon name string
   - Attach click handler on `sortIcon_btn`: `menu.open(sortIcon_btn)`
   - Push `menu` onto `self.popupMenus`
4. **Remove** `self.ui.contextMenus` container and its `appendTo(document.body)` call (~line 1577, 1599)
5. **`clear()` method** (~line 2124): Replace `jQuery.contextMenu('destroy', sel)` loop with iterating `self.popupMenus` and calling `.destroy()` on each

## Phase 5: Remove jquery-contextmenu dependency

- `index.js` — remove `import 'jquery-contextmenu'` and `import 'jquery-contextmenu/dist/jquery.contextMenu.min.css'`
- `datavis.js` — remove same
- `wcdatavis.css` — remove context-menu CSS overrides (~lines 1223-1228, 1283-1285)
- `package.json` — remove `"jquery-contextmenu": "=2.10.1"` dependency

## Phase 6: Update test infrastructure

- `tests/lib/grid.js` `clickActiveSortMenu()` (~line 435): Change selectors from `context-menu-root` / `context-menu-item` to `wcdv-popup-menu` / `wcdv-popup-menu-item`
- All `tests/pages/grid/*.html` files (~60+): Remove `<script src="../jquery.contextMenu.min.js">` and `<link rel="stylesheet" href="../jquery.contextMenu.min.css"/>`
- Delete `tests/pages/jquery.contextMenu.min.js` and `tests/pages/jquery.contextMenu.min.css`

## Relevant files

| File | Action | Notes |
|------|--------|-------|
| `src/ui/popup_menu.js` | NEW | PopupMenu widget (uses `makeSubclass`, `icon` from `src/util/misc.js`) |
| `src/ui/popup_menu.scss` | NEW | PopupMenu styles |
| `src/renderers/grid/table.js` | EDIT | Main consumer (~lines 187, 915-1020, 1577, 1599, 2124-2134) |
| `index.js` | EDIT | Import changes (lines 12-16) |
| `datavis.js` | EDIT | Import changes (lines 15-19) |
| `wcdatavis.css` | EDIT | Remove overrides (lines 1220-1287) |
| `package.json` | EDIT | Remove dependency (line 53) |
| `tests/lib/grid.js` | EDIT | Update selectors (lines 435-440) |
| `tests/pages/grid/*.html` | EDIT | Remove script/link tags (~60 files) |
| `tests/pages/jquery.contextMenu.min.js` | DELETE | |
| `tests/pages/jquery.contextMenu.min.css` | DELETE | |

## Verification

1. `npm run lint` on new/modified source files
2. `make tests` — rebuild test pages, verify they load
3. `make test` — run Selenium suite (sort tests exercise the menu via `sortByField` / `sortByAgg`)
4. Manual: open a grid test page, click a sort icon, verify menu appears positioned near the icon, items show icons + labels, clicking an item sorts and closes, clicking outside closes
5. `grep -r "contextmenu\|contextMenu\|context-menu\|jquery-contextmenu" src/ tests/` — confirm no stale references

## Decisions

- `addItem(label, icon, callback, userdata)` — label is display text, userdata is optional extra data passed to callback
- Separators supported via `addSeparator()` (current menus use `'----'`)
- Menu appended to `document.body` for z-index stacking (same as current plugin)
- Outside-click via `mousedown` on `document`
- SCSS file co-located in `src/ui/` per project's SASS-first approach
- Icon passed as a Lucide name string; `PopupMenu` calls `icon()` internally to create the SVG
