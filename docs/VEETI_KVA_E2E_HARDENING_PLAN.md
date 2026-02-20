# VEETI + KVA End-to-End Hardening Plan

## Goal
Deliver a production-ready onboarding flow for Finnish water utility CFOs that works from empty database to computed Ennuste and PDF export for two user types:
- KVA Excel users (with optional VEETI autofill for required water/wastewater drivers)
- Non-KVA users (manual setup + manual driver entry, including fallback when VEETI is unavailable)

## Ready Criteria (Definition of Done)
1. Empty DB -> login -> KVA import -> choose years (example 2023-2025) -> fill required driver values via in-app VEETI autofill -> confirm import succeeds.
2. Same KVA flow also succeeds fully without VEETI (manual entry in modal).
3. Ennuste page shows non-zero income and coherent KPIs after import, with clear baseline year + horizon and stable compute flow.
4. Creating a new scenario works.
5. Adding multiple investments (including same date/year) works and persists.
6. Editing yearly % changes and recomputing works.
7. PDF export from computed Ennuste succeeds (HTTP 200 + valid PDF body).
8. E2E coverage includes both KVA+VEETI path and manual fallback path.

## Current Issues To Resolve
- Required KVA fields are often missing and currently need manual repetitive input.
- No native VEETI pull in app for water/wastewater prices and sold volumes.
- Flow reliability gaps in scenario/investment recompute path are not covered by end-to-end tests.
- UX friction in KVA modal and Ennuste flow reduces onboarding clarity.

## Scope

### In Scope
- Add deterministic VEETI import (no AI) via backend integration and frontend controls.
- Keep manual input as first-class fallback in same modal and in manual setup wizard.
- Improve KVA modal clarity and validation messaging.
- Harden projection scenario/investment interactions and test them E2E.
- Extend tests (unit/component/E2E) to lock behavior.

### Out of Scope
- Full redesign of all tabs from scratch.
- Large domain model rewrites.
- Removal of existing KVA routes (additive changes preferred).

## Architecture Changes

### Backend
1. Add VEETI data service in API (`apps/api/src/budgets/veeti-import.service.ts`):
   - Resolve org by VEETI org id.
   - Fetch data from VEETI OData endpoints:
     - `TaksaKayttomaksu` (Tyyppi 1 water, 2 wastewater)
     - `LaskutettuTalousvesi` (sum by year)
     - `LaskutettuJatevesi` (year amount)
   - Return year-indexed driver payload + source metadata.
2. Add route in budgets controller:
   - `POST /budgets/import/veeti-drivers`
   - Request: `{ orgId: number; years: number[] }`
   - Response: `{ org, years, driversByYear, missingByYear, fetchedAt, source }`
3. Keep KVA confirm path as source of truth for persistence, using existing `editedDriversByYear` integration.
4. Add guardrails:
   - max year count
   - valid year ranges
   - clear errors for unavailable VEETI or missing yearly values

### Frontend
1. Extend `KvaImportPreview` with VEETI autofill controls:
   - VEETI org id input
   - “Hae VEETIstä valituille vuosille” action
   - Fill selected years’ matrix values (`yksikköhinta`, `myyty määrä`) for vesi/jätevesi
   - show data source + timestamp and missing-year warnings
2. Preserve manual fallback:
   - user can edit any field after VEETI import
   - if VEETI fails, modal remains usable with manual entry
3. UX refinements in modal:
   - cleaner action grouping (year selection, VEETI fetch, required matrix)
   - explicit error copy (which year/service/field missing)
4. Keep BudgetPage integration unchanged in behavior (import result refresh), with optional small copy improvements.

### Ennuste Flow Hardening
1. Ensure compute path receives valid baseline drivers after import (no zero-income regression).
2. Verify scenario create + override + investments state transitions remain stable.
3. Keep compute and save interactions deterministic with existing `driverPathsDirty` logic.

## Test Plan

### API tests
- VEETI service mapping:
  - prices by year/service
  - sold volume aggregation for talousvesi
  - missing-year handling
- Controller validation:
  - invalid org id / years payload
  - upstream error mapping

### Frontend tests
- KVA modal:
  - VEETI fetch populates matrix values
  - missing values still block confirm
  - manual edits after VEETI are respected

### E2E tests
1. Existing smoke: login -> KVA import -> Ennuste compute -> PDF export (keep).
2. New VEETI flow test:
   - import KVA fixture
   - choose target years
   - fetch VEETI drivers in modal
   - confirm import
   - compute + PDF export
3. New manual fallback flow:
   - no VEETI usage
   - fill required matrix manually
   - compute projection
   - create scenario
   - add multiple investments
   - verify recompute success

## Rollout Notes
- VEETI endpoint is optional enhancer; KVA/manual workflows remain fully functional without VEETI.
- If VEETI is down, UI must show actionable message and keep manual path available.

## Implementation Sequence
1. Build backend VEETI service + endpoint + tests.
2. Wire frontend API client for VEETI route.
3. Add VEETI controls and autofill behavior to KVA modal.
4. Refine modal UX copy and validation outputs.
5. Add/extend E2E coverage for VEETI and manual paths.
6. Run full test suite and fix regressions.
7. Commit changes with clear message and verification summary.

