# Plan: Replace jQuery UI Dialog with PopupWindow

## TL;DR
Build a new `PopupWindow` class in `src/ui/popup_window.js` (with companion `src/ui/popup_window.css`) that replaces jQuery UI's `dialog()` widget. The class provides `open()`, `close()`, `destroy()`, `setTitle()`, `setContent()`, and `setButtons()` methods. It is always modal, supports dragging by titlebar, resizing via a corner handle, and has a built-in 100ms fade transition. Then migrate all 8 files (31 dialog calls) to use PopupWindow.

## Phase 1: Build PopupWindow Class

### Step 1.1 -- Create `src/ui/popup_window.js`

**Class definition** using `makeSubclass('PopupWindow', Object, constructorFn)`.

**Constructor options** (mirror jQuery UI dialog's commonly-used options):
- `title` (string) -- window title text
- `width` (number|string) -- CSS width (default: 600)
- `maxHeight` (number|null) -- optional max-height for content area
- `position` (object) -- `{ my, at, of }` positioning spec (default: center of window)
  - Implement a simplified position resolver: support `'center'`, `'top'` at-values against a target element
- `content` (Element|jQuery|null) -- initial content element
- `buttons` (array) -- array of `{ icon, label, callback }` specs

**DOM structure** built in constructor or a private `_build()` method:
```
div.wcdv-popup-window-overlay          (modal backdrop, covers viewport)
  div.wcdv-popup-window                (the window itself, positioned absolute)
    div.wcdv-popup-window-titlebar     (draggable handle)
      span.wcdv-popup-window-title     (title text)
      button.wcdv-popup-window-close   (X close button, uses icon('x'))
    div.wcdv-popup-window-content      (scrollable content area)
    div.wcdv-popup-window-buttonbar    (button row, conditionally rendered)
      button.wcdv-popup-window-btn     (each button, with icon + label)
    div.wcdv-popup-window-resize       (resize handle, bottom-right corner)
```

**Methods:**
- `open()` -- append overlay to `document.body`, apply fade-in, set focus, fire 'open' event
- `close()` -- fade-out, remove from DOM (or hide), fire 'close' event
- `destroy()` -- close + remove all DOM + unbind events + null out references
- `setTitle(text)` -- update title span text
- `setContent(elt)` -- empty content area, append element (accept DOM element or jQuery object)
- `setButtons(buttonSpecs)` -- rebuild buttonbar from array of `{ icon, label, callback }`
- `_applyPosition()` -- position the window per the `position` option
- `_initDrag()` -- mousedown on titlebar starts drag; mousemove repositions; mouseup ends
- `_initResize()` -- mousedown on resize handle starts resize; mousemove adjusts width/height; mouseup ends

**Events** via `mixinEventHandling(PopupWindow, ['open', 'close'])`.

**Key patterns to follow:**
- `var self = this` as first line of every method
- Store all DOM refs in `self.ui` object
- Use jQuery for DOM creation (matching PopupMenu, Slider patterns)
- Use `icon()` from `src/util/misc.js` for close button and button icons
- IE10 compatible: no arrow functions, no template literals, use `var`
- Export: `export { PopupWindow };`

### Step 1.2 -- Create `src/ui/popup_window.css`

Styles for:
- `.wcdv-popup-window-overlay` -- fixed fullscreen, semi-transparent black backdrop, z-index: 1100, flexbox centering
- `.wcdv-popup-window` -- white background, border-radius, box-shadow, min-width, flex column layout
- `.wcdv-popup-window-titlebar` -- flex row, padding, background color, cursor: move (drag affordance), border-bottom
- `.wcdv-popup-window-title` -- flex: 1, font-weight bold, overflow ellipsis
- `.wcdv-popup-window-close` -- icon button, no border, cursor pointer, hover state
- `.wcdv-popup-window-content` -- flex: 1, overflow-y: auto, padding
- `.wcdv-popup-window-buttonbar` -- flex row, justify-content: flex-end, padding, gap, border-top
- `.wcdv-popup-window-btn` -- standard button styling with icon + label
- `.wcdv-popup-window-resize` -- bottom-right corner handle, cursor: nwse-resize
- Fade transitions via CSS opacity + transition (100ms)
- Visual styling should approximate the existing jQuery UI dialog look (white, rounded corners, shadow)

### Step 1.3 -- Register in build entry point

- Add `import './src/ui/popup_window.css';` to `datavis.js`
- Ensure `PopupWindow` is exported from wherever needed (likely re-exported from `index.js` or imported directly by consumers)

## Phase 2: Migrate All Dialog Usages

All 8 files migrated in one pass. Each migration replaces `jQuery('<div>').dialog({...})` with `new PopupWindow({...})`, `.dialog('open')` with `.open()`, `.dialog('close')` with `.close()`, and `.dialog('destroy')` with `.destroy()`.

### Step 2.1 -- `src/ui/windows/debug.js` (DebugWin)
- Replace `.dialog({...})` initialization (lines 33-50) with `new PopupWindow({ title, width: 600, maxHeight: 600, position: { my: 'center', at: 'top', of: window } })`
- Replace button creation (line ~184) with `pw.setButtons([{ icon: 'thumbs-up', label: buttonText, callback: function() { pw.close(); } }])`
- Replace `.dialog('open')` with `pw.open()`
- The close handler already calls destroy -- PopupWindow handles this
- jQuery UI `.tabs()` inside the content stays unchanged -- just pass the tab container via `pw.setContent(tabsDiv)`

### Step 2.2 -- `src/ui/windows/col_config.js` (ColConfigWin)
- Replace `.dialog({...})` (lines 38-58) with `new PopupWindow({ title: trans('GRID.COLCONFIG_WIN.TITLE'), width: 600 })`
- Move HTML button row into `pw.setButtons([{ icon: 'check', label: trans('DIALOG.OK'), callback: onOK }, { icon: 'ban', label: trans('DIALOG.CANCEL'), callback: onCancel }])`
- Replace `.dialog('open')` / `.dialog('close')` calls
- Custom sortable table content set via `pw.setContent(tableContainer)`

### Step 2.3 -- `src/ui/windows/grid_table_opts.js` (GridTableOptsWin)
- Replace `.dialog({...})` (lines 48-68) with `new PopupWindow({ title: 'Columns', width: 600, buttons: [...] })`
- Migrate buttons from jQuery UI config to `{ icon: 'check', label: 'OK', callback }` / `{ icon: 'ban', label: 'Cancel', callback }`
- Replace `.dialog('open')` / `.dialog('close')` / `.dialog('destroy')` calls

### Step 2.4 -- `src/ui/templates.js` (TemplatesEditor)
- Replace `self.win = jQuery('<div>').dialog({...})` (lines 23-48) with `self.win = new PopupWindow({ title: trans('GRID.TEMPLATE_EDITOR.TITLE'), width: 'auto', buttons: [...] })`
- Migrate OK/Cancel buttons
- Pass tab container as content
- Replace `self.win.dialog('open')` with `self.win.open()`, etc.

### Step 2.5 -- `src/group_fun_win.js` (GroupFunWin)
- Replace `.dialog({...})` (lines 22-42) with `new PopupWindow({ title, width: 600 })`
- This dialog has no built-in buttons -- buttons are HTML content inside the dialog
- Close callback (`self.cb(selected)`) -- use `pw.on('close', function() { self.cb(selected); })`
- Open callback (`selected = null`) -- use `pw.on('open', function() { selected = null; })`
- Replace `.dialog('open')` / `.dialog('close')` calls

### Step 2.6 -- `src/grid_control.js` (AggregateControlField)
- Replace `.dialog({...})` (lines 568-584) with `new PopupWindow({ title: trans(...), width: auto })`
- HTML-based OK/Cancel buttons inside content -- migrate to `pw.setButtons()`
- Replace `.dialog('open')` / `.dialog('close')` / `.dialog('destroy')` calls
- The `destroy()` call in the field's destroy method maps to `pw.destroy()`

### Step 2.7 -- `src/grid.js` (Perspective Window)
- Replace `.dialog({...})` (lines 1335-1348) with `new PopupWindow({ title: trans('GRID.PERSPECTIVE_WIN.TITLE'), width: 500, position: { my: 'top', at: 'bottom', of: titlebar } })`
- Simple dialog with readonly textarea content -- `pw.setContent(contentDiv)`
- Replace `.dialog('open')` call

### Step 2.8 -- `src/renderers/grid/table.js` (Full Value Window)
- Replace `.dialog({...})` (lines 1332-1343) with `new PopupWindow({ title: 'Full Value', width: 800, maxHeight: 600 })`
- Content is dynamically updated -- use `pw.setContent(div)` before each open
- Replace `.dialog('open')` call

## Phase 3: Cleanup

### Step 3.1 -- Remove jQuery UI dialog CSS overrides
- Remove `.wcdv_dialog { z-index: 1100 !important; }` from `wcdatavis.css` (line 1287) -- PopupWindow has its own z-index

### Step 3.2 -- Add i18n labels
- If any new user-facing strings are introduced (unlikely since we're reusing existing labels), add them to `en-US.tsv` and all `trans/*.tsv` files
- The close button (X) is an icon with no text -- needs an aria-label. Add `POPUP_WINDOW.CLOSE` label.

### Step 3.3 -- Accessibility
- Ensure overlay traps focus (tab cycling within dialog)
- Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title element
- Close button needs `aria-label`
- ESC key closes the dialog
- Return focus to previously focused element on close

## Relevant Files

**New files to create:**
- `src/ui/popup_window.js` -- the PopupWindow class
- `src/ui/popup_window.css` -- companion styles

**Files to modify:**
- `datavis.js` -- add CSS import for popup_window.css (line ~19, alongside popup_menu.css import)
- `src/ui/windows/debug.js` -- migrate DebugWin dialog
- `src/ui/windows/col_config.js` -- migrate ColConfigWin dialog
- `src/ui/windows/grid_table_opts.js` -- migrate GridTableOptsWin dialog
- `src/ui/templates.js` -- migrate TemplatesEditor dialog
- `src/group_fun_win.js` -- migrate GroupFunWin dialog
- `src/grid_control.js` -- migrate AggregateControlField options dialog
- `src/grid.js` -- migrate perspective window dialog
- `src/renderers/grid/table.js` -- migrate full value window dialog
- `wcdatavis.css` -- remove `.wcdv_dialog` rule (line 1287)
- `en-US.tsv` -- add `POPUP_WINDOW.CLOSE` aria-label translation
- `trans/*.tsv` -- add corresponding translation in each language file

**Reference files (patterns to follow):**
- `src/ui/popup_menu.js` -- `makeSubclass`, `icon()`, DOM construction patterns
- `src/ui/popup_menu.css` -- CSS naming convention
- `src/ui/slider.js` -- `mixinEventHandling`, `self.ui` pattern, `draw()` method
- `src/util/misc.js` -- `makeSubclass`, `mixinEventHandling`, `icon()` exports

## Verification

1. `npm run lint` -- ensure no lint errors in new and modified files
2. `make tests` -- build and copy to tests directory
3. `make test` -- run full Selenium test suite
4. Manual verification: open each migrated dialog in the browser and confirm:
   - Title displays correctly
   - Content renders correctly
   - Buttons work (icon + label + callback)
   - Close button (X) works
   - ESC key closes
   - Modal backdrop blocks interaction behind
   - Drag by titlebar works
   - Resize by corner handle works
   - Fade in/out animation plays
   - Focus trapping works (tab doesn't escape dialog)
   - jQuery UI tabs/accordion still work inside debug and template editor dialogs
5. Screen reader test: verify ARIA attributes are announced properly

## Decisions

- **Always modal** -- no `modal` option; backdrop always shown (matches all current usage)
- **jQuery UI tabs/accordion left in place** -- only dialog() is replaced; tabs() and accordion() inside dialogs remain
- **Built-in 100ms fade** -- CSS transition on opacity, matching current behavior
- **Draggable + Resizable** -- titlebar drag and corner resize handle (min-width 200px, min-height 100px)
- **Position API** -- simplified version of jQuery UI's `{ my, at, of }` supporting common cases (center, top/bottom relative to element)
- **Button icons use `icon()` function** -- Lucide icons via the existing `icon()` helper, not jQuery UI icon classes
- **Scope boundary** -- this plan does NOT remove jQuery UI as a dependency (tabs/accordion still use it)

## Further Considerations

1. **CSS visual parity** -- the new PopupWindow styles should closely match the existing jQuery UI dialog appearance to minimize visual disruption. Consider sampling the current computed styles as a reference.
2. **Resize constraints** -- PopupWindow enforces min-width 200px, min-height 100px during resize to prevent collapsing.
3. **Stacking** -- current usage is one modal at a time, so a fixed z-index is sufficient. If multi-dialog stacking is ever needed, it can be added later.
