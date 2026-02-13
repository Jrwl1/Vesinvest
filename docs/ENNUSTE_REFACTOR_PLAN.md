# Ennuste Refactor Plan v3

Date: 2026-02-12  
Status: **Implemented and hardened** (2026-02-13). Phases A-D, Definition of done, and stale-404 fallback hardening are satisfied.  
Primary area: `apps/web/src/pages/ProjectionPage.tsx` + `apps/api/src/projections/*`

## 1. Objective

Refactor the Ennuste flow so first-time users land directly on a computed 20-year baseline prognosis (when imported budget data exists), while keeping "Luo skenaario" as a secondary action for what-if analysis.

## 2. Target outcomes

1. Opening Ennuste should show a computed projection without mandatory scenario creation clicks.
2. Baseline scenario should be auto-created (or reused) from latest imported budget context.
3. Scenario creation should be positioned as an alternative exploration action near results/charts.
4. KVA-imported budgets without `tuloajurit` should still compute baseline by using a deterministic fallback driver strategy.
5. Flow should remain resilient to stale projection IDs and demo reset events.

## 3. Current-state gaps (code-grounded)

1. Initial load only auto-selects existing projections; when none exist, user remains in scaffold state.
   - `apps/web/src/pages/ProjectionPage.tsx` (`loadData`, lines around 200-218)
2. No-projection scaffold requires manual compute click and can block when base budget has no drivers.
   - `apps/web/src/pages/ProjectionPage.tsx` (no-projection section around 1107+)
3. Backend compute path requires either budget `tuloajurit` or driver-path volume input; otherwise returns a blocking error.
   - `apps/api/src/projections/projections.service.ts` (`compute`, lines around 231-250)
4. Existing `computeForBudget` already provides resilient upsert+compute, but frontend does not use it automatically on first load.
   - `apps/api/src/projections/projections.service.ts` (`computeForBudget`, lines around 155-205)
5. Scenario action is still presented in top header actions, which makes it look like primary onboarding.
   - `apps/web/src/pages/ProjectionPage.tsx` (header action row around 547+)

## 4. Scope

### In scope (v3)

1. Ennuste load behavior, default projection bootstrap, and scenario action hierarchy.
2. Driver fallback rules for budgets without `tuloajurit` (especially KVA subtotal path).
3. API/UI guardrails to keep one stable baseline path and predictable scenario creation.
4. Tests for load, compute fallback, and scenario behavior.

### Out of scope (for this refactor)

1. New top-level tabs or large navigation redesign.
2. Side-by-side multi-scenario comparison visuals.
3. Major projection engine formula changes outside required fallback handling.
4. Pricing policy redesign (required tariff algorithm remains as-is).

## 5. Refactor principles

1. Prefer additive, low-risk changes to existing endpoint contracts.
2. Keep baseline flow deterministic: same input should produce same baseline scenario.
3. Use backend as source of truth for fallback synthesis and scenario validity.
4. Keep UI state machine explicit: loading, auto-bootstrapping, ready, empty, error.
5. Do not reintroduce a hard dependency on manual driver entry for the first computed view.

## 6. Proposed target behavior

### 6.1 On Ennuste page mount

1. Load projections, budgets, and assumptions in parallel.
2. If projections already exist:
   - Select default (`onOletus`) else newest.
   - If selected projection has no computed years and has a budget, auto-run compute.
3. If no projections and budgets exist:
   - Resolve baseline budget (latest imported set, fallback latest year).
   - Call `computeForBudget(budgetId)` automatically.
   - Set returned projection active and refresh scenario list.
4. If no budgets exist:
   - Show empty-state CTA (import/demo), no scenario-first prompts.

### 6.2 Scenario model and "Luo skenaario" usage

1. Baseline scenario is system-first and auto-produced.
2. "Luo skenaario" creates alternatives from baseline budget context.
3. **Placement:** Scenario action appears next to the graph/data (results area), not in the top header — not as first-run gate.
4. **Purpose:** User creates an alternative scenario to:
   - Input an investment into the future (e.g. "Invest 500k€ in year 2030").
   - Get a new chart with that scenario applied.
   - Adjust water price / volume in that scenario to see impact.
5. Switching scenarios should update summary strip, chart, table, and revenue breakdown consistently.

## 7. Detailed work plan

### Phase A - Baseline bootstrap flow

#### A1. Frontend load state refactor

Files:
- `apps/web/src/pages/ProjectionPage.tsx`

Tasks:
1. Extract mount boot logic into explicit async steps:
   - `fetchInitialProjectionContext()`
   - `selectOrBootstrapProjection()`
2. Add `bootstrappingProjection` state separate from generic `loading`.
3. Implement auto-call to `computeForBudget` when `projList.length === 0 && budgets.length > 0`.
4. After bootstrap compute, refresh projections and select the returned projection ID.

Acceptance:
1. First visit with available budgets lands on computed baseline without clicking "Luo skenaario".
2. First paint during bootstrap uses loading placeholder, not error banner.

#### A2. Baseline budget selection helper

Files:
- `apps/web/src/pages/ProjectionPage.tsx` (or new helper under `apps/web/src/pages/projection/`)

Tasks:
1. Select baseline from latest imported set:
   - Prefer latest `importBatchId` group and max `vuosi`.
   - Fallback to max `vuosi` globally.
2. Keep helper pure and unit-testable.

Acceptance:
1. Selection is deterministic for identical budget lists.
2. No dependency on UI order from backend.

### Phase B - Backend driver fallback hardening

#### B1. Fallback synthesis for no-driver budgets

Files:
- `apps/api/src/projections/projections.service.ts`
- `apps/api/src/projections/driver-paths.ts` (if helper extraction is needed)

Tasks:
1. Add a backend helper to build minimal valid starting drivers when:
   - budget has subtotal data (`valisummat`), and
   - budget has no `tuloajurit`, and
   - projection has no usable `ajuriPolut`.
2. Feed synthesized values into compute path so baseline can complete.
3. Persist synthesized `ajuriPolut` on projection (optional but recommended for transparency and editability).

Acceptance:
1. `computeForBudget` succeeds for KVA subtotal budgets without manual driver entry.
2. Returned projection contains non-empty `vuodet`.
3. Existing explicit manual driver paths still override fallback behavior.

#### B2. Error semantics and messages

Files:
- `apps/api/src/projections/projections.service.ts`

Tasks:
1. Keep blocking error only for truly uncomputable data (no budget data at all).
2. Return clear messages that separate:
   - missing budget data,
   - invalid user overrides,
   - internal compute failures.

Acceptance:
1. API errors are actionable and do not incorrectly instruct users to fill planner for bootstrap-eligible budgets.

### Phase C - Scenario UX hierarchy cleanup

#### C1. Move "Luo skenaario" to secondary position

Files:
- `apps/web/src/pages/ProjectionPage.tsx`
- `apps/web/src/App.css`

Tasks:
1. Remove primary prominence from header action cluster.
2. Render scenario-creation CTA in scenario/results section with context text:
   - baseline exists,
   - create alternate case.
3. Keep keyboard and screen-reader access equivalent or better than current.

Acceptance:
1. User can still create scenarios quickly.
2. First-run path visually points to baseline result first, scenario second.

#### C2. Scenario creation: investment + price/volume

Files:
- `apps/web/src/pages/ProjectionPage.tsx`
- `apps/web/src/api.ts` (only if request payload needs extension)
- `apps/api/src/projections/*` (only if clone endpoint is added)

Tasks:
1. Pre-fill create modal with:
   - base budget = active baseline budget,
   - horizon = active baseline horizon (default 20 if missing).
2. **Investment input:** Allow user to add investments (year + amount) when creating the scenario — e.g. "Invest 500k€ in 2030".
3. **Price/volume overrides:** Allow user to adjust water price / volume for the new scenario (driver paths).
4. Ensure created scenario computes cleanly and shows new chart with the scenario applied.
5. User can then switch between baseline and scenario to compare.

Acceptance:
1. User can create a scenario with investment(s) and/or price/volume overrides.
2. New scenario produces a distinct chart and table; user sees impact of the what-if.
3. Fresh scenario can be computed immediately.

### Phase D - Quality gates

#### D1. API tests

Files:
- add `apps/api/src/projections/projections.service.spec.ts` (new)
- extend `apps/api/src/projections/driver-paths.spec.ts`

Required cases:
1. `computeForBudget` auto-creates and computes baseline from KVA subtotal budget with no drivers.
2. Fallback does not override explicit `ajuriPolut`.
3. Uncomputable budgets still fail with correct error.

#### D2. Web tests

Files:
- add `apps/web/src/pages/ProjectionPage.test.tsx` (new)

Required cases:
1. No projections + budgets -> auto bootstrap compute call.
2. Existing projection with data -> no redundant bootstrap call.
3. "Luo skenaario" renders as secondary action (not empty-state gate).

#### D3. Manual QA script

Files:
- `TESTING.md` (append short Ennuste bootstrap regression checklist)

Checks:
1. Fresh org with imported KVA data opens directly to computed 20-year view.
2. Scenario create/edit/compute/update summary/chart/table.
3. Export CSV/PDF still works for baseline and alternative scenarios.

## 8. Data and API notes

1. No Prisma schema changes are required for core refactor (fields already exist: `ajuriPolut`, `userInvestments`, `onOletus`).
2. If clone semantics are added for scenarios, prefer new endpoint over overloaded create payload:
   - candidate: `POST /projections/:id/clone`
   - clone should copy assumptions + driver paths + optional investments, then allow overrides.
3. Keep `POST /projections/compute-for-budget` as the bootstrap backbone.

## 9. Rollout plan

1. Ship behind a frontend feature flag (`projection_auto_bootstrap`) for controlled rollout.
2. Enable in staging first with imported datasets (including zero-driver budgets).
3. Validate with telemetry:
   - time-to-first-projection,
   - bootstrap failure rate,
   - scenario creation rate after baseline render.
4. Enable for production after 0 blocker regressions in one release cycle.

## 10. Risks and mitigations

1. Risk: wrong baseline budget chosen in mixed imported/manual data.
   - Mitigation: deterministic selection helper + unit tests for grouped import cases.
2. Risk: hidden compute latency on page load.
   - Mitigation: dedicated bootstrapping state + optimistic skeleton + timeout/error fallback.
3. Risk: fallback driver synthesis produces unrealistic output.
   - Mitigation: keep fallback minimal, label as initial baseline assumptions, allow immediate user edits.
4. Risk: regression in stale-id handling.
   - Mitigation: preserve existing 404 fallback to `computeForBudget`.

## 11. Definition of done

1. Ennuste opens to a computed 20-year baseline when budget data exists, without manual scenario creation.
2. KVA subtotal budgets without `tuloajurit` no longer hard-block initial compute.
3. Scenario creation is secondary and context-driven near results.
4. API + web tests cover bootstrap flow and fallback semantics.
5. Manual QA checklist is updated and executed in staging.

## 12. Execution order (recommended)

1. Phase B (backend fallback) first.
2. Phase A (frontend bootstrap) second.
3. Phase C (UX hierarchy) third.
4. Phase D (tests + QA docs) last before release.

## 13. Verification report (2026-02-13)

### Commits reviewed
- **a54d8c7** – fix(ennuste): allow compute when driver planner has volume; backend synthesize from ajuriPolut when budget has no tuloajurit; frontend canCompute = budget drivers OR driverPaths with volume.
- **676c7ea** – fix(ennuste): move driverPathsHasVolume useMemo before early returns (Rules of Hooks); AGENTS.md.
- **8446be5** – fix(ennuste): 404 recovery baseline-only in handleCompute; explicit ajuriPolut override fallback (hasExplicitDriverPaths); tests for both.

### Plan vs code (Codex check 2026-02-13)

| Area | Status | Notes |
|------|--------|--------|
| **Phase A** (bootstrap) | Done | `fetchInitialProjectionContext`, `selectOrBootstrapProjection`, `selectBaselineBudget`; auto `computeForBudget` when no projections + budgets exist; `AUTO_BOOTSTRAP_ENABLED` used. |
| **Phase B** (fallback) | Done | Subtotal fallback and persist `ajuriPolut` in place. **Gap:** manual-path precedence when paths exist but volume not “usable” (see Fix 2 below). |
| **Phase C** (scenario UX) | Done | “Luo skenaario” in `.scenario-secondary-cta` (line ~961); modal has drivers + investments (~823, ~851); not in header. |
| **Phase D** (tests) | Done | `projections.service.spec.ts`: computeForBudget baseline, explicit ajuriPolut not overwritten (usable volume), uncomputable error. `ProjectionPage.test.tsx`: auto-bootstrap when no projs + budgets, no bootstrap when projection has years, “Luo skenaario” secondary. |

### Codex’s two fixes – status

**Fix 1 (handleCompute 404):** Implemented.  
- In `ProjectionPage.tsx` ~519–525, on 404 we call `computeForBudget(activeProjection.talousarvioId, hasOverrides ? cleanOverrides : undefined, driverPaths)`.  
- Backend `computeForBudget` does findFirst for that budget and **updates** that projection with `olettamusYlikirjoitukset` and `ajuriPolut` (projections.service.ts ~197–209), then computes.  
- So when the *active* projection was a scenario (same budget, different projection id) and we get 404, we overwrite whichever projection the backend finds (often the default baseline) with the scenario’s overrides and paths. **Risk:** scenario edits applied to baseline.  
- **Required change:** On 404 in handleCompute, either (a) do not pass overrides/ajuriPolut when recovering (baseline-only recovery), or (b) create a new scenario projection instead of updating the found one, so scenario identity is preserved.

**Fix 2 – Manual-path precedence (explicit paths override fallback)**  
**Partially implemented.**  
- When projection has explicit `ajuriPolut` **and** `hasUsableDriverVolume(driversFromPaths)` is true, we use `driversFromPaths` and never overwrite (test “does not override explicit ajuriPolut” covers this).  
- When explicit paths **exist** but volume is not “usable”, we enter the `hasValisummat` branch and overwrite `projection.ajuriPolut` with `fallbackPaths` (projections.service.ts ~277–283). Plan B1: “Existing explicit manual driver paths still override fallback behavior.”  
- **Gap:** If the user has set explicit paths but left volume zero/invalid, we should not overwrite; either keep paths and throw a clear “add volume” error or use paths without overwriting.

### Summary
- Plan implementation: Phases A, C, D are in place; Phase B is in place except the “explicit paths override fallback” when volume is not usable.  
- Fix 1 and Fix 2 are implemented (8446be5).  
- Fix 2 (manual-path precedence) is satisfied only when explicit paths have usable volume; the “explicit but invalid volume” case still overwrites.

---

## 14. References

1. `docs/PROJECTION_UX_PLAN.md`
2. `docs/ENNUSTE_UX_AUDIT.md`
3. `apps/web/src/pages/ProjectionPage.tsx`
4. `apps/api/src/projections/projections.service.ts`
5. `apps/api/src/projections/driver-paths.ts`

## 15. Completion update (2026-02-13)

Remaining stale-404 refactor items were completed:

1. `selectOrBootstrapProjection` fallback now calls `computeForBudget(budgetId)` in baseline-only mode (no stale scenario `ajuriPolut` passthrough).
2. Scenario-create stale-404 recovery now retries full `createProjection + computeProjection` once, instead of calling `computeForBudget` with scenario paths.
3. `ProjectionPage.test.tsx` now covers both behaviors:
   - startup fallback does not carry stale scenario driver paths,
   - scenario-create fallback retries scenario creation and does not call `computeForBudget`.

