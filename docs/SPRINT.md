# Sprint

Window: 2026-02-12 to 2026-05-20

Exactly 5 executable DO items. Execute top-to-bottom.
Each `Do` cell checklist must be flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Required substep shape:
- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | status: clean`
Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
`DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

**Ennuste UI/UX betterment:** Deliver a working Ennuste UI with every problem in `docs/ENNUSTE_UX_AUDIT.md` addressed. The audit lists 33 issues in 9 areas; this sprint is structured in 5 steps (S-01..S-05), with S-05 being the final pass that confirms all 33 items are closed.

## Recorded decisions (this sprint)

**Ennuste UX lock** (unchanged): Per-year and `% from year X` inputs stay on the same Ennuste screen (no modal for variables). Diagram is a sub-view with same data as table. See `docs/PROJECTION_UX_PLAN.md`.

**Create scenario:** May be implemented as a modal (audit 13–14) to separate from active-projection content; this does not conflict with "no modal for variable inputs."

**RevenueReport:** Purpose and visibility will be clarified (collapse, "for print/export," or toggle) per audit 22–26; PDF/export content must remain available.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | DriverPlanner layout and structure: grid/side-by-side, service grouping, reduce percent-mode redundancy, prominent Save/Reset and dirty warning. See S-01 substeps below. | apps/web/src/components/DriverPlanner.tsx, apps/web/src/App.css, apps/web/src/pages/ProjectionPage.tsx | Audit 1–8 addressed: variables not stacked in one column; Vesi/Jätevesi grouping clear; Save/Reset and "save before compute" visible; optional collapse/summary. | 13dd1a9, 0157267, 6d3897b, 4d56bb4 | Stop if layout conflicts with same-screen variables in PROJECTION_UX_PLAN.md. | READY |
| S-02 | Controls row, create scenario, top hierarchy: responsive controls, Assumptions discoverable, last-computed timestamp, Compute-disable reason on screen, create scenario as modal. See S-02 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json | Audit 9–14 addressed: controls hierarchy clear; Assumptions discoverable; last computed shown; Compute disabled reason visible; create scenario is modal with clear separation. | 86cce45, 04b0bd9 | Stop if modal for create conflicts with product decision. | IN_PROGRESS |
| S-03 | Verdict, result tabs, main table, diagram: verdict weight or collapse; no-drivers hint in context; prominent Taulukko/Diagrammi tabs; coherent diagram view; table sticky column or column hide, optional summary. See S-03 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/ProjectionCharts.tsx, apps/web/src/App.css | Audit 15–21 addressed: verdict not overwhelming; hint in context; tabs prominent; diagram coherent; table usable on small screens, depreciation hide or deprioritized. | Evidence needed | Stop if diagram/table changes conflict with PROJECTION_UX_PLAN. | TODO |
| S-04 | RevenueReport and bottom content: collapsible or toggle; clarify purpose; reduce on-screen overlap; clear end-of-page. See S-04 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/RevenueReport.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json | Audit 22–26 addressed: RevenueReport not always-on in same way; purpose clear; no "random info at bottom"; end of page clear; export/print still supported. | Evidence needed | Stop if PDF/export content is reduced without approval. | TODO |
| S-05 | Global layout, a11y, and final pass: scenario delete affordance; anchor links or sticky nav; stronger empty-state CTAs; a11y (labels, verdict role/aria-live, result tabs semantics); verify all 33 audit items addressed. See S-05 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/DriverPlanner.tsx, apps/web/src/components/RevenueReport.tsx, apps/web/src/App.css, docs/ENNUSTE_UX_AUDIT.md | Working Ennuste UI with every audit problem addressed; REVIEW can confirm against audit; evidence includes checklist or sign-off for items 1–33. | Evidence needed | Stop if a11y or structural change requires product scope change. | TODO |

### S-01 substeps
- [x] Add CSS grid (or equivalent) for `.driver-planner__grid` so driver cards/fields can sit side-by-side or in a compact layout; ensure responsive behavior
  - files: apps/web/src/App.css, apps/web/src/components/DriverPlanner.tsx
  - run: pnpm --filter web typecheck
  - evidence: commit:13dd1a9 | run: pnpm --filter web typecheck -> PASS | files: App.css | docs: N/A | status: clean
- [x] Strengthen visual grouping of Vesi vs Jätevesi (card, border, or section wrapper) so the two fields per service are clearly grouped
  - files: apps/web/src/components/DriverPlanner.tsx, apps/web/src/App.css
  - run: pnpm --filter web test -- src/components/
  - evidence: commit:0157267 | run: pnpm --filter web test -- src/components/ -> 8 passed | files: DriverPlanner.tsx, App.css | docs: N/A | status: clean
- [x] Reduce redundancy in percent-mode preview (e.g. single shared year list or compact inline preview) so the same year range is not repeated four times
  - files: apps/web/src/components/DriverPlanner.tsx
  - run: pnpm --filter web typecheck
  - evidence: commit:6d3897b | run: pnpm --filter web typecheck -> PASS | files: DriverPlanner.tsx, App.css | docs: N/A | status: clean
- [x] Make Save and Reset buttons and the "save before compute" dirty warning visually prominent (e.g. placement, style, or inline message near Compute)
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck
  - evidence: commit:4d56bb4 | run: pnpm --filter web typecheck -> PASS | files: ProjectionPage.tsx, App.css | docs: N/A | status: clean

### S-02 substeps
- [x] Rework projection controls row for responsiveness and clear primary/secondary hierarchy (e.g. Compute primary, Assumptions secondary)
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck
  - evidence: commit:86cce45 | run: pnpm --filter web typecheck -> PASS | files: ProjectionPage.tsx, App.css | docs: N/A | status: clean
- [x] Make Assumptions toggle more discoverable (label, icon, or placement)
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: commit:04b0bd9 | run: pnpm --filter web typecheck -> PASS | files: ProjectionPage.tsx, App.css, en/fi/sv.json | docs: N/A | status: clean
- [ ] Add "last computed" timestamp or scenario-updated indicator and surface Compute disabled reason on screen (not only tooltip)
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] Convert create-scenario form to a modal and ensure clear separation from active-projection content when open
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web test -- src/pages/
  - evidence: pending

### S-03 substeps
- [ ] Reduce verdict card visual weight (e.g. compact layout or collapsible) and move no-drivers hint into verdict area or table header when relevant
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] Make Taulukko/Diagrammi result view tabs more prominent (size, position, or tab strip)
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] Improve diagram view coherence (e.g. tabbed charts, single scrollable panel, or clearer grouping) so it does not feel like five unrelated blocks
  - files: apps/web/src/components/ProjectionCharts.tsx, apps/web/src/App.css
  - run: pnpm --filter web test -- src/components/ProjectionCharts
  - evidence: pending
- [ ] Improve main table for small screens: sticky first column and/or option to hide depreciation columns; optional sticky header or summary row
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck
  - evidence: pending

### S-04 substeps
- [ ] Make RevenueReport collapsible or behind a "Show revenue breakdown" / "Detailed breakdown" toggle
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/RevenueReport.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] Clarify RevenueReport purpose (e.g. heading or short description: "For print/export" or "Detailed breakdown by source")
  - files: apps/web/src/components/RevenueReport.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] Add a clear end-of-page element (footer, divider, or "End of Ennuste" cue) after the result content
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: N/A (visual)
  - evidence: pending

### S-05 substeps
- [ ] Improve scenario delete affordance (e.g. label, confirmation state, or placement so relationship to current scenario is clear)
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] Add in-page anchor links or sticky nav so user can jump to Variables, Results, or Export without long scroll
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] Strengthen empty-state and no-projection CTAs (visibility, copy, or placement)
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] A11y: ensure assumption override and DriverPlanner inputs have correct labels/aria; add verdict role/aria-live where appropriate; implement proper tab semantics for Taulukko/Diagrammi
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/DriverPlanner.tsx
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] Final pass: walk docs/ENNUSTE_UX_AUDIT.md items 1–33 and confirm each is addressed; document evidence (e.g. checklist in Evidence cell or audit section)
  - files: docs/ENNUSTE_UX_AUDIT.md, docs/SPRINT.md
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: pending
