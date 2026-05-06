## Plan: Section 508 Accessibility Remediation for DataVis GLIDE

**TL;DR**: Live browser testing revealed severe Section 508 violations — 143 unlabeled buttons, 107 unlabeled form controls, no landmarks, no live regions, no heading structure, and an inaccessible chart canvas. Some components (PopupWindow, Tabs, Collapsible) already have good ARIA patterns that can serve as implementation templates. The fix requires 7 phases across ~12 source files.

---

### Critical Issues Found

| # | Severity | Issue | Count |
|---|----------|-------|-------|
| 1 | P1 | Buttons without accessible names (sort/resize in headers) | 143 |
| 2 | P1 | Form controls without labels (selects, checkboxes, radios) | 107 |
| 3 | P1 | Canvas chart has no role, aria-label, or fallback | 1 |
| 4 | P1 | No landmark regions (`<main>`, `<nav>`, etc.) | 0 found |
| 5 | P1 | No aria-live regions (pagination, filter changes) | 0 found |
| 6 | P1 | Table `<th>` elements lack `scope="col"` and `<caption>` | 74 headers |
| 7 | P2 | Column headers lack `aria-sort` state | all columns |
| 8 | P2 | Radio groups not in `<fieldset>`/`<legend>` | 2 groups |
| 9 | P2 | No skip navigation link | - |
| 10 | P2 | Perspective combobox unlabeled | - |
| 11 | P3 | No DataVis-specific focus indicator styles | only 1 rule |
| 12 | P3 | Slider/resize are mouse-only (no keyboard) | - |

---

### Steps

**Phase 1: Table & Grid Accessibility** (highest impact)
1. Add `scope="col"` to all `<th>` elements
2. Add `<caption>` or `aria-label` to the data table
3. Add `aria-sort` to sortable column headers (update on sort)
4. Add `aria-label` to sort buttons ("Sort by {column}")
5. Add `aria-label` to resize handles ("Resize {column} column")

**Phase 2: Form Control Labeling**
6. Label perspective combobox (`aria-label`)
7. Wrap radio groups in `<fieldset>`+`<legend>`
8. Label filter/group field selectors
9. Label select-all checkbox in header

**Phase 3: Landmark Structure & Navigation**
10. Add `role="toolbar"` + `aria-label` to toolbar sections
11. Add landmark roles (main, nav for pagination)
12. Add heading hierarchy (h1 grid title, h2 sections)
13. Add skip navigation link

**Phase 4: Dynamic Content & Live Regions** (*parallel with Phase 3*)
14. Add `aria-live="polite"` to pagination/status area
15. Announce filter additions/removals
16. Announce sort state changes
17. Announce record count changes

**Phase 5: Graph/Chart Accessibility** (*parallel with Phases 3-4*)
18. Add `role="img"` + `aria-label` to `<canvas>`
19. Add fallback content inside `<canvas>` element
20. Label graph type selector

**Phase 6: Keyboard & Focus** (*depends on Phases 1-2*)
21. Add visible focus indicator CSS for all DataVis interactive elements
22. Add keyboard support to Slider (arrow keys)
23. Add keyboard column resize mechanism
24. Ensure logical tab order

**Phase 7: Testing** (*depends on all above*)
25. Add axe-core automated accessibility audit
26. Add keyboard navigation tests
27. Add screen reader announcement tests

---

### Relevant Files

- `src/grid_renderer.js` — Table rendering, column headers, sort/resize buttons
- `src/grid_control.js` — Toolbar, perspective selector, radio groups
- `src/grid_filter.js` — Filter panel, field selectors
- `src/grid.js` — Grid container, titlebar, structure
- `src/graph_renderer.js` — Chart canvas rendering
- `src/ui/toolbar.js` — Toolbar section (needs `role="toolbar"`)
- `src/ui/slider.js` — Slider (needs keyboard support)
- `src/ui/popup_window.js` — REFERENCE: good ARIA dialog pattern
- `src/ui/tabs.js` — REFERENCE: good ARIA tabs pattern
- `wcdatavis.css` — Add focus indicator styles
- `en-US.tsv` — I18N labels for new aria-label strings

---

### Verification
1. Run axe-core audit on `tests/pages/grid/vite.html` — target zero critical/serious violations
2. Keyboard-only navigation test: complete all operations without mouse
3. Screen reader test (VoiceOver): verify all controls announced with purpose
4. Verify `aria-sort` updates dynamically when sorting
5. Verify live region announces pagination/filter changes
6. Run `npm run lint` and `make test` for regressions

---

### Decisions
- All new label strings go into `en-US.tsv` (+ translation TSV files) per I18N guidelines
- Use existing PopupWindow/Tabs/Collapsible as reference implementations for ARIA patterns
- Focus indicator: 2px blue outline matching existing omnifilter style (`border-color: #66afe9; box-shadow`)
- Chart accessibility via `role="img"` + hidden data table (best screen reader support)
- Scope: Grid + Graph source components only; test page HTML structure is not in scope
