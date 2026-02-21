# Ennuste Refactor Plan + Audit (Implemented)

## Scope
- End-to-end flow: login -> KVA/VEETI/manual baseline -> Ennuste -> PDF export.
- Stabilize 3-year import integrity, Talousarvio persistence, and Ennuste UX.

## Locked Decisions
- 3-year KVA confirm is atomic (all-or-nothing transaction).
- Compute is blocked when baseline drivers are missing/inconsistent.
- Assumption defaults are seeded in backend and read consistently by UI.
- Tulonjako stays, collapsible by default, redesigned.
- Advanced `Tuloajurit (tarkka syöttö)` main-flow block removed.
- Combined volume edit split: 50/50 to `vesi` and `jatevesi` until separate values provided.

## Audit Findings (pre-implementation)
- `/budgets/sets/:batchId` payload missed `tuloajurit` -> year cards showed zeroed prices.
- Set-card combined volume changes used local storage and did not persist service drivers.
- KVA confirm used per-year loop -> partial sets possible on failure.
- Year picker allowed contradictory non-consecutive selections in edge cases.
- Projection assumptions fallback diverged from backend defaults.
- Redundant/unused blocks in Ennuste increased confusion and maintenance debt.

## Implemented
- Added transactional batch confirm API for KVA import (`confirm-kva-batch`) and switched UI to batch call.
- Added backend projection guardrails:
  - missing required baseline drivers => structured validation error.
  - baseline revenue mismatch vs subtotal Tulot => structured validation error.
- Added assumptions auto-seed on first read when org has no rows.
- Added `tuloajurit` to set payload and persisted set-card combined volume edits (50/50 split).
- Added set integrity warning for non-3-year/non-consecutive sets.
- Cleaned KVA required-fields UX:
  - only show hard error styles after validation gate.
  - manual-entry state for previously missing cells.
  - stricter consecutive-year selectability.
- Projection page cleanup:
  - removed dead paths/states,
  - added inline validation guidance banner + CTA to Talousarvio,
  - kept chart + assumptions + investments + collapsible Tulonjako.
- Redesigned Tulonjako table with explicit Vesi/Jätevesi split columns and clearer totals.
- Updated/added tests and fixed E2E smoke to validate both manual fallback and VEETI-assisted flow.

## Validation Run
- `pnpm typecheck` (pass)
- `pnpm --filter ./apps/api test -- projections.service.spec.ts budgets.service.spec.ts budgets.repository.spec.ts` (pass)
- `pnpm --filter ./apps/web test -- ProjectionPage.test.tsx KvaImportPreview.test.tsx` (pass)
- `pnpm e2e -- e2e/ennuste.smoke.spec.ts` (pass)
