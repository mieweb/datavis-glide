# Plan: Replace jQuery UI Tabs and Accordion with Tabs and Collapsible

## TL;DR

Build two new UI widget classes -- `Tabs` (`src/ui/tabs.js`) and `Collapsible` (`src/ui/collapsible.js`) -- with companion CSS files, to replace jQuery UI's `.tabs()` and `.accordion()` widgets. Then migrate the 2 files that use them: `src/ui/windows/debug.js` (tabs + accordion) and `src/ui/templates.js` (tabs only). The look should be compact and minimal.

## Phase 1: Build Tabs Class

### Step 1.1 -- Create `src/ui/tabs.js`

**Class definition** using `makeSubclass('Tabs', Object, constructorFn)`.

**Constructor** receives a container element (jQuery or DOM) to render into:
- `container` (Element|jQuery) -- the element the tabs widget will be built inside
- Initializes `self.ui = {}` with DOM references
- Initializes `self._pages = []` (array of `{ id, label, headerEl, panelEl }`)
- Initializes `self._activeIndex = -1`
- Calls `self._build()` to create DOM skeleton

**DOM structure** built in `_build()`:
```
div.wcdv-tabs                         (root wrapper)
  ul.wcdv-tabs-nav                    (tab header row)
    li.wcdv-tabs-tab                  (one per page, clickable)
      a.wcdv-tabs-tab-link            (tab label text)
  div.wcdv-tabs-panel                 (one per page, content area; only active one visible)
```

**Methods:**
- `addPage(label, contentElt)` -- append a new tab header + panel; `contentElt` is a DOM element or jQuery object placed into the panel div; returns the page index; if this is the first page, auto-activate it
- `switchPage(index)` -- deactivate current tab, activate the specified tab (toggle `.wcdv-tabs-tab-active` class on header, show/hide panels); no-op if already active
- `destroy()` -- remove all DOM, unbind events, null out references

**Key patterns:**
- `var self = this` first line everywhere
- Store DOM refs in `self.ui` (`self.ui.root`, `self.ui.nav`)
- Use jQuery for DOM creation (matches PopupWindow pattern)
- Click handler on each tab header calls `self.switchPage(index)`
- IE10 compatible: `var`, no arrow functions, no template literals
- ARIA: `role="tablist"` on nav, `role="tab"` + `aria-selected` on headers, `role="tabpanel"` + `aria-labelledby` on panels, `id` linkage between tab and panel
- Export: `export { Tabs };`

### Step 1.2 -- Create `src/ui/tabs.css`

Compact, minimal styling:
- `.wcdv-tabs` -- display flex, flex-direction column
- `.wcdv-tabs-nav` -- list-style none, display flex, margin/padding 0, border-bottom 1px solid #ddd, gap 0
- `.wcdv-tabs-tab` -- display inline-block, cursor pointer
- `.wcdv-tabs-tab-link` -- display block, padding ~6px 12px, text-decoration none, color #555, border 1px solid transparent, border-bottom none, border-radius 3px 3px 0 0, font-size 13px
- `.wcdv-tabs-tab-active .wcdv-tabs-tab-link` -- background #fff, border-color #ddd, color #333, margin-bottom -1px (overlap the nav border)
- `.wcdv-tabs-tab-link:hover` -- color #333, background #f5f5f5
- `.wcdv-tabs-panel` -- padding 8px, display none
- `.wcdv-tabs-panel-active` -- display block

### Step 1.3 -- Register in build entry point

- Add `import './src/ui/tabs.css';` to `datavis.js` (alongside other UI CSS imports, ~line 21)

## Phase 2: Build Collapsible Class

### Step 2.1 -- Create `src/ui/collapsible.js`

**Class definition** using `makeSubclass('Collapsible', Object, constructorFn)`.

**Constructor** receives a container element:
- `container` (Element|jQuery) -- the element the collapsible widget will be built inside
- Initializes `self.ui = {}` with DOM references
- Initializes `self._sections = []` (array of `{ label, headerEl, panelEl, isOpen }`)
- Calls `self._build()` to create DOM skeleton

**DOM structure** built in `_build()`:
```
div.wcdv-collapsible                        (root wrapper)
  div.wcdv-collapsible-section              (one per section)
    div.wcdv-collapsible-header             (clickable header)
      span.wcdv-collapsible-icon            (chevron icon, rotates when open)
      span.wcdv-collapsible-title           (section title text)
    div.wcdv-collapsible-panel              (content area, hidden when collapsed)
```

**Methods:**
- `addSection(label, contentElt)` -- append a new section (header + panel); `contentElt` is DOM/jQuery content; returns the section index; first section is opened by default
- `openSection(index)` -- expand a section (show panel, rotate icon, add `.wcdv-collapsible-section-open` class); no-op if already open
- `closeSection(index)` -- collapse a section; no-op if already closed
- `switchSection(index)` -- close all other sections, open the specified one (exclusive accordion-style behavior matching jQuery UI's default)
- `destroy()` -- remove all DOM, unbind events, null out references

**Key patterns:**
- Same OOP patterns as Tabs (makeSubclass, var self = this, self.ui)
- Use `icon('chevron-right')` from `src/util/misc.js` for the expand/collapse indicator; CSS rotates it 90deg when open
- Click handler on each header calls `self.switchSection(index)` (accordion behavior -- matches jQuery UI default of one-section-at-a-time)
- ARIA: `role="heading"` on headers (or use `<h3>`), `aria-expanded` on headers, `aria-controls` / `id` linkage, panels have `role="region"`
- IE10 compatible
- Export: `export { Collapsible };`

### Step 2.2 -- Create `src/ui/collapsible.css`

Compact, minimal styling:
- `.wcdv-collapsible` -- border 1px solid #ddd, border-radius 3px
- `.wcdv-collapsible-section` -- border-bottom 1px solid #ddd (last-child: none)
- `.wcdv-collapsible-header` -- display flex, align-items center, padding 6px 10px, cursor pointer, background #f9f9f9, user-select none, font-size 13px, font-weight 600, color #444
- `.wcdv-collapsible-header:hover` -- background #f0f0f0
- `.wcdv-collapsible-icon` -- width 16px, height 16px, margin-right 6px, transition transform 150ms, flex-shrink 0
- `.wcdv-collapsible-icon svg.wcdv_icon` -- width 14px, height 14px
- `.wcdv-collapsible-section-open .wcdv-collapsible-icon` -- transform rotate(90deg)
- `.wcdv-collapsible-panel` -- display none, padding 8px 10px
- `.wcdv-collapsible-section-open .wcdv-collapsible-panel` -- display block

### Step 2.3 -- Register in build entry point

- Add `import './src/ui/collapsible.css';` to `datavis.js`

## Phase 3: Migrate All Usages

### Step 3.1 -- `src/ui/windows/debug.js` (Tabs + Accordion)

**Current state:** Builds a `<div>` with `<ul>` tab headers and 4 tab panel `<div>`s, calls `.tabs()`. Each panel contains `<h3>` + content pairs wrapped in `.accordion({ heightStyle: "content" })`.

**Migration -- Tabs:**
- Import `Tabs` from `../tabs.js`
- Remove the manual `<ul>` + `<a href="#id">` construction
- Create `var tabsWidget = new Tabs(tabsDiv)`
- For each tab definition, call `tabsWidget.addPage(t.name, container)` instead of manually appending to tabsDiv
- Remove `tabsDiv.tabs()` call

**Migration -- Accordion:**
- Import `Collapsible` from `../collapsible.js`
- Replace the manual `<h3>` + `ti.elt` append loop + `container.accordion(...)` with:
  - `var collapsible = new Collapsible(container)`
  - For each `t.items` entry: `collapsible.addSection(ti.name, ti.elt)`
- Remove `container.accordion({ heightStyle: "content" })` call

### Step 3.2 -- `src/ui/templates.js` (Tabs only)

**Current state:** Builds a `<div>` with `<ul>` and 3 tab panels using `tabs.tabs()`.

**Migration:**
- Import `Tabs` from `./tabs.js`
- Replace manual `<ul>` + `<li>` + `<a href="#id">` construction with:
  - `var tabsWidget = new Tabs(tabsContainer)`
  - For each tab: `tabsWidget.addPage(displayName, div)` (using the existing `makeTab` return values)
- Remove `tabs.tabs()` call
- The `makeTab` function currently returns `{ li, div, inputs }` -- the `li` property will no longer be needed. Simplify return to `{ div, inputs }`.

## Phase 4: Cleanup

### Step 4.1 -- Check if jQuery UI can be downscoped

After this migration, jQuery UI is still needed for: `draggable`, `droppable`, `sortable`, `progressbar`. **Do NOT remove** jQuery UI import from `datavis.js` -- it's still used elsewhere. No jQuery UI CSS overrides to remove for tabs/accordion (none existed).

### Step 4.2 -- Add i18n labels (if needed)

Tabs and Collapsible don't introduce new user-facing text strings -- labels come from callers. No new TSV entries needed.

### Step 4.3 -- Accessibility

- **Tabs:** `role="tablist"` on nav, `role="tab"` + `aria-selected` on tab headers, `role="tabpanel"` + `aria-labelledby` on panels, keyboard support (left/right arrow to switch tabs)
- **Collapsible:** headers use `aria-expanded`, panels use `role="region"` + `aria-labelledby`, keyboard support (Enter/Space to toggle)

## Relevant Files

**New files to create:**
- `src/ui/tabs.js` -- the Tabs class
- `src/ui/tabs.css` -- companion styles
- `src/ui/collapsible.js` -- the Collapsible class
- `src/ui/collapsible.css` -- companion styles

**Files to modify:**
- `datavis.js` -- add CSS imports for tabs.css and collapsible.css (~line 21, alongside popup_menu.css and popup_window.css)
- `src/ui/windows/debug.js` -- migrate from `.tabs()` + `.accordion()` to `Tabs` + `Collapsible`
- `src/ui/templates.js` -- migrate from `.tabs()` to `Tabs`

**Reference files (patterns to follow):**
- `src/ui/popup_window.js` -- `makeSubclass`, `self.ui`, jQuery DOM construction, class structure
- `src/ui/popup_window.css` -- CSS naming convention (`wcdv-` prefix, BEM-like)
- `src/ui/popup_menu.js` -- simpler widget example, `icon()` usage
- `src/util/misc.js` -- `makeSubclass`, `icon()` exports

## Verification

1. `npm run lint` -- ensure no lint errors in new and modified files
2. `make tests` -- build and copy to tests directory
3. `make test` -- run full Selenium test suite
4. Manual verification -- open Debug Info window:
   - All 4 tabs render and switch correctly (Source, View, Grid, Prefs)
   - Accordion sections within each tab expand/collapse correctly
   - Only one accordion section open at a time (accordion behavior)
   - Content displays correctly (definition lists, JSON formatters)
5. Manual verification -- open Template Editor:
   - All 3 tabs render and switch correctly (Plain, Grouped, Pivotted)
   - Textareas populate with correct template values
   - OK/Cancel buttons still work
6. Visual check -- compact, minimal appearance matching the popup_window style (neutral grays, small padding, 13px font)
7. Accessibility -- verify ARIA attributes with screen reader or DevTools inspection

## Decisions

- **Tabs uses explicit `addPage()` API** rather than parsing existing DOM `<ul>/<li>` structure -- simpler, more explicit
- **Collapsible `switchSection()` is exclusive** (accordion-style: one section at a time) -- matches jQuery UI accordion default behavior
- **Collapsible also exposes `openSection()`/`closeSection()`** for non-exclusive use if needed later
- **No animation on tabs switch** -- instant show/hide (matches jQuery UI tabs default)
- **Collapsible icon uses Lucide `chevron-right`** -- rotated 90deg via CSS when section is open, providing a compact visual indicator
- **jQuery UI NOT removed** -- still needed for draggable/droppable/sortable/progressbar
- **No new i18n entries needed** -- labels supplied by callers
- **Scope boundary** -- only replaces tabs/accordion; does not touch sortable, draggable, droppable, or progressbar jQuery UI usage
