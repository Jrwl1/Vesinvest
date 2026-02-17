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

**Ennuste two-zone UX:** Implement the Syötä / Tulokset flow from `docs/ENNUSTE_UX_FLOW_PLAN.md` and `docs/ENNUSTE_IMPLEMENTATION_STEPS.md`. Scenario → Syötä (edit) → Compute → Tulokset (read). No Muuttujat/Tulokset/Tulonjako tabs; one input zone, one results zone; accordion in Syötä; minimal text.

## Recorded decisions (this sprint)

**Ennuste UX lock** (unchanged): Per-year and `% from year X` inputs stay on the same Ennuste screen (no modal for variables). Diagram is a sub-view with same data as table. See `docs/PROJECTION_UX_PLAN.md`.

**Two-zone plan:** Reference `docs/ENNUSTE_IMPLEMENTATION_STEPS.md`. Codex recommendations are merged into phases. Execute order: zone containers first, then move assumptions card into Syötä, then move result blocks into Tulokset, then replace nav/tabs/toggles.

**Codex locked decisions (all mandatory):**
- **Single source of truth:** This sprint uses only `docs/SPRINT.md` + `docs/ENNUSTE_IMPLEMENTATION_STEPS.md`.
- **Empty-state CTA:** Tulokset empty-state button scrolls/focuses Syötä; compute only from the single "Laske uudelleen" in Syötä.
- **Accordion:** Multi-open allowed; first section (Olettamukset) open by default.
- **S-05 mandatory:** All five items (S-01..S-05) are required. Final substep = perfectly working site as planned (full flow, all capabilities, tests and lint pass).

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | Phase A — Two-zone shell and scenario row: remove scenario-secondary-cta; add Syötä and Tulokset zones (id=ennuste-syota, ennuste-tulokset); replace anchor nav with two links (Syötä, Tulokset); add zone CSS; add i18n zoneInput, zoneResults, emptyResultsHint (fi/en/sv). See S-01 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/fi.json, en.json, sv.json | scenario-secondary-cta removed; two zones with headings; two in-page links only; zone CSS and i18n keys present. | 370fce1, 80bed03, 97e03b8, b67a8cb, 14abaad | Stop if product scope forbids removing scenario CTA or changing anchor targets. | DONE |
| S-02 | Phase B — Syötä zone: move #projection-variables.projection-assumptions-card wholesale into Syötä; implement accordion (Olettamukset, Investoinnit, Tuloajurit); sticky mini-summary; single Laske uudelleen with dirty hint; one primary compute only. See S-02 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css | All inputs and compute live in Syötä; accordion with three sections; mini-summary; one compute button; DriverPlanner/assumptions/investments preserved. | d03fbc2 (B1) | Stop if Rules of Hooks broken or compute/dirty logic lost. | IN_PROGRESS |
| S-03 | Phase C — Tulokset zone: empty state when !hasComputedData; move KPIs and year selector into Tulokset; chart and year inspector; drivers (3 bullets); details/summary for table and tulonjako; table/diagram as compact toggle. See S-03 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css | Tulokset always visible; empty state or full results; KPIs, chart, year row, drivers, collapsible table, collapsible tulonjako; resultViewMode as small toggle. | — | Stop if table/diagram or revenue capability removed. | TODO |
| S-04 | Phase D — Cleanup and parity: remove obsolete nav/text; verify horizon, assumptions, investments, drivers, compute, export, compare, delete, table, diagram, revenue, year select, KPIs all work; a11y (accordion, zones, focus order). See S-04 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css | No Muuttujat/Tulokset/Tulonjako as top-level tabs; capability checklist passed; aria/roles for zones and accordion. | — | Stop if any required capability regresses. | TODO |
| S-05 | Phase E — Extract EnnusteScenarioRow, EnnusteSyotaZone, EnnusteTuloksetZone; add Suspense/skeletons for chart and table; final substep = perfectly working site as planned. See S-05 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/* (new or existing) | Extracted components; Suspense boundaries; full flow works; lint/typecheck/test pass; site matches plan. | — | Stop if extraction breaks state or tests. | TODO |

### S-01 substeps
- [x] Remove scenario-secondary-cta block (JSX and any CSS for .scenario-secondary-cta); keep scenario row as single row (pills, Luo skenaario, delete)
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:370fce1ef0e8ab6dca7483e025c0ead2267be382 | run: typecheck + test -> FAIL (pnpm bootstrap blocked: EACCES/EAI_AGAIN) | files: apps/web/src/App.css, apps/web/src/pages/ProjectionPage.tsx | docs:N/A | status: clean
- [x] Wrap main content in two sections: #ennuste-syota (heading from i18n zoneInput), #ennuste-tulokset (heading from i18n zoneResults); leave zone content placeholders for B/C
  - files: apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:80bed03 | run: typecheck + test -> PASS | files: ProjectionPage.tsx, ProjectionPage.test.tsx | docs: N/A | status: clean
- [x] Add anchor compatibility: temporary aliases (#projection-variables → #ennuste-syota, #projection-results-view → #ennuste-tulokset) or update tests/links that reference old IDs; then replace anchor nav with two links (Syötä href=#ennuste-syota, Tulokset href=#ennuste-tulokset) and remove third link (Tulonjako)
  - files: apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:97e03b8 | run: typecheck + test -> PASS | files: ProjectionPage.tsx | docs: N/A | status: clean
- [x] Add zone CSS under .projection-page / [data-ennuste-layout]: .ennuste-zone, .ennuste-zone__heading; clear visual separation
  - files: apps/web/src/App.css
  - run: pnpm --filter web typecheck
  - evidence: commit:b67a8cb | run: typecheck -> PASS | files: App.css | docs: N/A | status: clean
- [x] Add i18n projection.zoneInput, projection.zoneResults, projection.emptyResultsHint in fi.json, en.json, sv.json
  - files: apps/web/src/i18n/locales/fi.json, en.json, sv.json
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:14abaad | run: typecheck + test -> PASS | files: fi/en/sv.json, ProjectionPage.tsx | docs: N/A | status: clean

### S-02 substeps
- [x] Move #projection-variables.projection-assumptions-card (horizon, compute row, assumptions toggle/table, investments editor, DriverPlanner) wholesale into Syötä zone
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:d03fbc2 | run: typecheck + test -> PASS | files: ProjectionPage.tsx | docs: N/A | status: clean
- [ ] Implement accordion: Olettamukset (open by default), Investoinnit, Tuloajuriden suunnittelu; multi-open allowed; preserve all handlers
  - files: apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:<hash> | run: typecheck + test -> <result> | files: <paths> | status: clean
- [ ] Add sticky mini-summary at top of Syötä (horizon, volym/kulut/investoinnit derived from state)
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:<hash> | run: typecheck + test -> <result> | files: <paths> | status: clean
- [ ] Single Laske uudelleen at bottom of Syötä; disable when !canCompute or driverPathsDirty; show save-drivers hint; remove duplicate compute; empty-state CTA in Tulokset scrolls/focuses Syötä only
  - files: apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:<hash> | run: typecheck + test -> <result> | files: <paths> | status: clean

### S-03 substeps
- [ ] Tulokset always rendered: when !hasComputedData show empty state (heading + emptyResultsHint + CTA that scrolls/focuses Syötä only); when hasComputedData show results
  - files: apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:<hash> | run: typecheck + test -> <result> | files: <paths> | status: clean
- [ ] Move KPI panel and year selector from hero into top of Tulokset; hero chart-only or chart below KPI row
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:<hash> | run: typecheck + test -> <result> | files: <paths> | status: clean
- [ ] Place chart and year inspector in Tulokset; drivers as 3-bullet summary; table and tulonjako in details/summary (collapsible)
  - files: apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:<hash> | run: typecheck + test -> <result> | files: <paths> | status: clean
- [ ] Table/diagram as compact toggle (resultViewMode); no large Muuttujat/Tulokset/Tulonjako tabs
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:<hash> | run: typecheck + test -> <result> | files: <paths> | status: clean

### S-04 substeps
- [ ] Remove obsolete nav labels and long inline text; replace with short labels + tooltips where needed
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: commit:<hash> | run: pnpm --filter web typecheck -> <result> | files: <paths> | status: clean
- [ ] Verify: horizon, assumptions, investments, drivers, compute, export, compare, delete, table, diagram, revenue, year select, KPIs all work
  - files: apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:<hash> | run: <commands> -> <result> | files: <paths> | status: clean
- [ ] A11y: accordion (expanded/aria), zone headings, focus order; result toggle semantics
  - files: apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web typecheck
  - evidence: commit:<hash> | run: pnpm --filter web typecheck -> <result> | files: <paths> | status: clean

### S-05 substeps
- [ ] Extract EnnusteScenarioRow, EnnusteSyotaZone, EnnusteTuloksetZone (or equivalent) from ProjectionPage; pass state/handlers as props; no behavior change
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:<hash> | run: typecheck + test -> <result> | files: <paths> | status: clean
- [ ] Add Suspense with skeletons for chart and table; no behavior change
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck && pnpm --filter web test -- src/pages/
  - evidence: commit:<hash> | run: typecheck + test -> <result> | files: <paths> | status: clean
- [ ] Final acceptance: perfectly working site as planned — full Ennuste flow (scenario → Syötä → compute → Tulokset), all capabilities (horizon, assumptions, investments, drivers, compute, export, compare, delete, table, diagram, revenue, year, KPIs), pnpm lint + typecheck + test pass
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: commit:<hash> | run: lint/typecheck/test -> PASS | files: <paths> | status: clean
