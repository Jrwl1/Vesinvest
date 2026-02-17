# Ennuste two-zone UX — implementation steps

Implement the flow agreed in [docs/ENNUSTE_UX_FLOW_PLAN.md](ENNUSTE_UX_FLOW_PLAN.md) and Codex recommendations: **Scenario → Syötä (edit) → Compute → Tulokset (read)** with no Muuttujat/Tulokset/Tulonjako tabs and minimal text.

**Sprint source of truth:** This doc + [docs/SPRINT.md](SPRINT.md) are the single source for this sprint.

---

## Locked decisions (Codex — all mandatory)

- **Empty-state CTA:** Tulokset empty-state button scrolls/focuses Syötä only. Compute only from the single "Laske uudelleen" in Syötä.
- **Accordion:** Multi-open allowed; first section (Olettamukset) open by default.
- **S-05 mandatory:** All five sprint items (S-01..S-05) required. Final substep = perfectly working site (full flow, all capabilities, lint/typecheck/test pass).
- **Execution quality:** Run `pnpm --filter web test -- src/pages/` (or equivalent) in S-01, S-02, S-03; anchor compatibility step before removing old IDs; optional lightweight visual check per phase.

---

## Scope and constraints

- **Non-negotiables (unchanged):** DriverPlanner stays same-screen with full per-year and %-from-year-X controls; table and diagram both remain available; "Laske uudelleen" and last-computed/dirty state stay visible.
- **Reference:** [docs/ENNUSTE_UX_FLOW_PLAN.md](ENNUSTE_UX_FLOW_PLAN.md) (layout sketch, what to remove, Codex section).
- **Main file:** [apps/web/src/pages/ProjectionPage.tsx](../apps/web/src/pages/ProjectionPage.tsx) (~1495 lines). State and handlers stay; only structure, JSX, and class names change. Optional: extract subcomponents and add Suspense in a later step.

**Codex — move boundaries:** The page has one large `activeProjection && (...)` block. Move content from `scenario-secondary-cta` through `projection-page-end` into two zone wrappers (`#ennuste-syota`, `#ennuste-tulokset`); keep create-modal, topbar, and scenario pills outside and unchanged. **Exact source for Syötä:** the whole `#projection-variables.projection-assumptions-card` (horizon, compute row, assumptions toggle/table, investments editor, DriverPlanner). **Exact result blocks that become children of Tulokset:** `projection-year-inspector`, `projection-drivers-summary`, `projection-anchor-nav`, `#projection-results-view`, `#projection-revenue`, footer, and the empty-state branch. Add i18n keys `projection.zoneInput`, `projection.zoneResults`, `projection.emptyResultsHint` (and en/sv parity) **before** JSX replacement.

---

## Phase A — Two-zone shell and scenario row

**A1. Remove redundant block and keep scenario row only**

- Remove the entire `scenario-secondary-cta` section (the card with `scenarioSecondaryTitle` + `scenarioSecondaryHint` and the second "+ Luo skenaario" button). Scenario creation stays only in the top scenario row (pills + "Luo skenaario" + delete).
- Ensure the scenario row is a single row: scenario pills, "Luo skenaario", delete; no paragraph below.
- **Codex:** Remove JSX and any CSS for `.scenario-secondary-cta` and `.scenario-secondary-cta__content`.

**A2. Introduce two-zone layout and in-page anchors**

- Wrap the main content (after scenario row) in two semantic sections:
  - **Syötä zone:** `id="ennuste-syota"`, heading "Syötä" (or i18n `projection.zoneInput`). Contains only inputs and compute (to be filled in Phase B).
  - **Tulokset zone:** `id="ennuste-tulokset"`, heading "Tulokset" (or i18n `projection.zoneResults`). Contains only results (to be filled in Phase C).
- Replace the current anchor nav (three links: Muuttujat, Tulokset, Tulonjako) with **two** in-page links: "Syötä" (href="#ennuste-syota") and "Tulokset" (href="#ennuste-tulokset"). Remove the third link (Tulonjako / `anchorRevenue`); map the two links to `#ennuste-syota` and `#ennuste-tulokset`. Class remains `.projection-anchor-nav` unless renamed.
- Default scroll/focus: if `hasComputedData`, scroll or focus Tulokset; else Syötä (optional, can be same-page anchors only).
- **Codex:** Current anchor targets `#projection-variables`, `#projection-results-view`, `#projection-revenue` will change; add temporary compatibility (e.g. alias elements or update tests/links) before deleting old targets, then replace with two links only.

**A3. CSS for two zones**

- In [apps/web/src/App.css](../apps/web/src/App.css) add classes for the two-zone layout under `.projection-page` (or existing `[data-ennuste-layout="codex"]`): e.g. `.ennuste-zone`, `.ennuste-zone__heading`, clear visual separation (border or background) so "edit here" vs "results here" is obvious. Reuse existing Codex tokens if already present.

**A4. i18n**

- Add keys: `projection.zoneInput` ("Syötä"), `projection.zoneResults` ("Tulokset"), and `projection.emptyResultsHint` ("Laske ennuste nähdäksesi tulokset" / "Compute to see results") in [apps/web/src/i18n/locales/fi.json](../apps/web/src/i18n/locales/fi.json), en, sv.

---

## Phase B — Syötä zone: accordion and single compute

**B1. Move all inputs into Syötä**

- Current inputs live in the hero left column: `#projection-variables.projection-assumptions-card` (horizon, compute button, assumptions toggle/table, investments editor, DriverPlanner). **Move this entire block wholesale** into the Syötä zone to avoid partial duplication. Hero left will later hold only the KPI panel (or be removed and KPIs moved into Tulokset; see Phase C).
- So after A2: Syötä zone contains the former "Antaganden" card content; Tulokset contains KPIs, chart, year inspector, drivers, table, revenue.
- **Codex:** Layout anchors today are `projection-hero`, `projection-hero__left`, `projection-hero__right`, `projection-assumptions-card*`; either keep these class names on moved nodes or add `.ennuste-zone*` wrappers and migrate styles incrementally.

**B2. Accordion structure for Syötä**

- Replace the current flat layout (horizon + compute + "Olettamukset ▼" toggle + assumptions table + "Investeringar ▼" / "Tuloajuriden suunnittelu ▼" section toggles) with an **accordion**:
  - **Section 1 — Olettamukset:** Horizon dropdown, volume/cost (and other assumption) overrides. Reuse existing `showAssumptions` content (assumptions table) inside this accordion panel. First section open by default.
  - **Section 2 — Investoinnit:** Current investments list (year + amount, add, save). Collapsed by default.
  - **Section 3 — Tuloajuriden suunnittelu:** Full DriverPlanner component. Collapsed by default.
- Implement accordion with local state (e.g. set of open keys). **Multi-open allowed;** first section (Olettamukset) open by default. Use `<details>`/`<summary>` or button + conditional render. Preserve all existing handlers (horizon change, assumption overrides, investment add/remove, driver paths save).
- **Codex:** Reuse or normalize to accordion state; declare any new state at the top level so hook order is preserved (no new hooks inside `activeProjection`/`hasComputedData` branches).
- Keep a **sticky mini-summary** at the top of Syötä (inside the zone, above accordion): e.g. "Horisontti 20 v · Volym −1 % · Kulut +2,5 % · Investoinnit 2" (read-only, derived from state). No new API; compute from `activeProjection`, assumptions, and `userInvestments` length.

**B3. Single "Laske uudelleen" and dirty state**

- One primary button "Laske uudelleen" at the bottom of the Syötä zone (or below accordion). Disable when `!canCompute` or when `driverPathsDirty` (show save-drivers hint). Optionally disable when no input has changed since last compute (track dirty state for assumptions/horizon/investments if desired; Codex says "disabled until input changes exist"). Keep existing `handleCompute`, `computing`, and last-computed timestamp (one line, small text).
- **Codex:** Primary compute in Syötä only. **Tulokset empty-state CTA scrolls/focuses Syötä only** (does not call handleCompute). When relocating the compute row, carry both disable logic and the dirty hint together.
- Remove duplicate compute button so only one primary "Laske uudelleen" remains.

**B4. Reset actions (optional for MVP)**

- Per-section "Palauta oletus" in Olettamukset (reset overrides to org defaults) and one "Palauta kaikki" with confirm dialog in Syötä footer. Can be a follow-up step if time-boxed; document in backlog if deferred.

**B5. Helper text as tooltips**

- Replace any long inline descriptions with a short label + tooltip (e.g. `title` or a small "i" icon with `aria-describedby`). Remove the long "Vaihtoehtoinen what-if…" paragraph (already removed with scenario-secondary-cta).

---

## Phase C — Tulokset zone: results only and empty state

**C1. Tulokset always visible; empty state**

- Tulokset zone is always rendered. When `!hasComputedData`: show empty-state (heading "Tulokset" + `projection.emptyResultsHint` + CTA that **scrolls/focuses Syötä only**). When `hasComputedData`: show full results (C2–C5).

**C2. Move KPIs and year selector into Tulokset**

- Move the current KPI panel (sustainability, required tariff, final cumulative, deficit years, year selector) from the hero left column into the **top of the Tulokset zone**. So: hero no longer has a left column with two cards; hero can be **chart only** (full width) or chart below a single row of KPIs. Prefer: Tulokset = KPIs row + year selector, then chart, then year inspector row, then drivers, then collapsible table and revenue.
- Layout: KPI cards in a row (or 2x3 grid), year dropdown, then main chart (tariff €/m³).

**C3. Chart and year inspector**

- Chart: keep existing `ProjectionCharts` with `mode="hero"` (tariff trend). Place it in Tulokset below the KPIs. Optionally give the chart a short title (e.g. "Vesihinta €/m³") and remove long subtitle; use tooltip for "required tariff over period" if needed.
- Year inspector: keep the five metric boxes (Tulot, Kulut, Poistot, Investoinnit, Tulos) below the chart. Label with selected year (e.g. "Valittu vuosi: 2025").

**C4. Drivers and table/diagram**

- "Miksi tulos näyttää tältä?" stays three one-line bullets (volume trend, Kulut, investoinnit ja poistot). Use existing `volumeTrendText`, `opexTrendText`, `capexImpactText`; styling as in Codex (e.g. `.driver-item` with left border).
- **Table:** Keep the full results table. Use `<details>`/`<summary>` with summary "Näytä taulukko", default open=false. Table content unchanged (columns, formatting).
- **Diagram:** Keep the diagram view (second chart view). Per plan, "one chart mode by default; alternate views to lightweight toggles". Keep `resultViewMode` state; **replace only** the large `.result-view-tabs` tab strip with compact segmented controls (e.g. "Taulukko | Diagrammi"); do not change chart/table data logic.
- **Tulonjako:** Keep the revenue breakdown. Make it a second collapsible: "Näytä tulonjako" (same as current revenue-report toggle), closed by default. Keep `showResultsTable` and `showRevenueReport` toggles independent inside Tulokset to match current behavior and minimize regression.

**C5. Hero removal or simplification**

- After moving KPIs and all inputs out of the hero: the "hero" is either (a) removed and content is a single column (Syötä then Tulokset), or (b) hero is only the chart (full width) and sits inside Tulokset. Prefer (b): one scroll, Syötä on top, Tulokset below with KPIs → chart → year row → drivers → details (table) → details (tulonjako). No left/right split.

**C6. CSS for Tulokset**

- Reuse/expand Codex styles for KPI grid, chart card, year-inspector, driver-item, details/summary for table and revenue. Ensure empty state is clearly styled (centered message, optional CTA).

---

## Phase D — Cleanup and parity

**D1. Remove obsolete UI**

- Remove: scenario-secondary-cta block (done in A1). Remove: old three-link anchor nav (replaced in A2). Remove: any duplicate "Luo skenaario" or export buttons that are redundant (keep one export set in topbar).
- Ensure: no "Muuttujat" / "Tulokset" / "Tulonjako" as top-level tabs or labels; only "Syötä" and "Tulokset" as zone headings and anchor targets.

**D2. Preserve capability**

- Checklist: horizon change, assumption overrides, investments add/edit/remove, driver paths edit and save, compute, export CSV/PDF, compare scenarios, delete scenario, view table, view diagram, view revenue breakdown, select year, read KPIs and driver bullets. All must still work; only placement and accordion/toggles change.

**D3. Accessibility**

- Accordion: use `aria-expanded` and `aria-controls` on section triggers; `role="region"` and `aria-labelledby` for each zone. Keep "Laske uudelleen" and last-computed as `role="status"`. Ensure focus order: scenario row → Syötä (accordion, then compute) → Tulokset (KPIs, year, chart, table toggle, tulonjako toggle).

---

## Phase E — Components, Suspense, and final acceptance (mandatory)

**E1. Extract components**

- Extract from ProjectionPage.tsx: `EnnusteScenarioRow`, `EnnusteSyotaZone` (accordion + compute + mini-summary), `EnnusteTuloksetZone` (empty state + KPIs + chart + year inspector + drivers + table + revenue). Pass state and handlers as props. Goal: reduce single-file size and clarify boundaries.

**E2. Suspense and skeletons**

- Wrap chart and/or table in `React.Suspense` with a simple skeleton (e.g. placeholder div with min-height) so that during compute or heavy re-render the rest of the page stays interactive. No behavior change.

**E3. Final acceptance**

- Perfectly working site as planned: full Ennuste flow (scenario → Syötä → compute → Tulokset), all capabilities (horizon, assumptions, investments, drivers, compute, export, compare, delete, table, diagram, revenue, year, KPIs), and `pnpm lint && pnpm typecheck && pnpm test` pass.

---

## Implementation order (recommended)

**Codex:** Execute in this order to reduce broken refs: (1) create two zone containers and headings, (2) move the assumptions card wholesale into Syötä, (3) move KPI/year/chart/year-inspector/results blocks into Tulokset, (4) replace nav/tabs/toggles.

1. **Phase A** — Two-zone shell, remove scenario CTA block, two anchors, CSS, i18n (add zone keys in fi/en/sv before JSX changes).
2. **Phase B** — Move inputs into Syötä; implement accordion (Olettamukset, Investoinnit, Tuloajurit); sticky mini-summary; single compute button and dirty hint.
3. **Phase C** — Tulokset: empty state, move KPIs and year select, chart, year inspector, drivers, details/summary for table and tulonjako; table/diagram as small toggle.
4. **Phase D** — Remove obsolete nav/text, verify all capabilities and a11y.
5. **Phase E** — Extract components, add Suspense/skeletons, final acceptance (perfectly working site).

---

## Files to touch (summary)

| File | Changes |
|------|--------|
| apps/web/src/pages/ProjectionPage.tsx | Restructure into Syötä and Tulokset zones; move KPI panel and inputs; add accordion state and markup; remove scenario-secondary-cta and old anchor nav; add empty state in Tulokset; table/diagram as toggle; details/summary for table and revenue. |
| apps/web/src/App.css | Two-zone layout classes; accordion styles; Syötä sticky mini-summary; Tulokset empty state; ensure existing Codex/ennuste-* styles apply. |
| apps/web/src/i18n/locales/fi.json (and en, sv) | projection.zoneInput, projection.zoneResults, projection.emptyResultsHint. Optional: accordion section titles if not reusing existing keys. |

---

## Testing and acceptance

- After each phase: load Ennuste tab, select scenario, open each accordion section and edit horizon/assumptions/investments/drivers, save drivers, compute, and confirm KPIs and chart update. Open "Näytä taulukko" and "Näytä tulonjako", switch table/diagram toggle. Export CSV/PDF, compare scenarios, delete scenario. No regression in existing behaviour; only layout and navigation change.
- A11y: keyboard through Syötä (accordion, compute) and Tulokset; screen reader announces zone headings and section names.
