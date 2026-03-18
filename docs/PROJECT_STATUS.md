# Project status

Last updated: 2026-03-19

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The `Yhteenveto` perfection queue through `S-92` is accepted and closed.
- The step-2 modernization and QDIS queue through `S-97` is accepted; only the final `S-98` live audit was blocked by a missing real 2022 QDIS PDF input.
- Live Kronoby verification showed that years `2022`, `2023`, and `2024` all miss `Material och tjanster` from VEETI even though they otherwise look importable.
- The KVA workbook provides truthful multi-year financial-row repairs for those years, while the 2024 statement PDF acts as a stronger full-year finance source rather than a one-line fix.
- The active sprint `S-99..S-106` is accepted and closed: workbook selective override, the explicit 2024 mixed-source merge, `Investointiohjelma`, PTS-derived `Poistosaannot`, visible Forecast impact wiring, and the closing Kronoby live audit all passed.
- The audit-fix queue `S-107..S-112` is accepted and closed: trial reset now clears VEETI override/year-policy residue, Step 3 sync-save refreshes cached effective values, scenario `Poistosaannot` now affect computed depreciation, capex-heavy funding surfaces promote cumulative-cash pressure, the group-to-depreciation handoff auto-maps only obvious cases, and the final remediation audit passed.

## Top blockers

1. Current customer docs provide a clear source for the six shared financial rows, but not one equally clear cross-year sold-volume import source.

## Next actions

1. Prepare the next planned queue after the accepted `S-107..S-112` audit-fix closeout.
2. Keep the cross-year sold-volume source question explicit if workbook-driven volume override returns to scope.
3. Treat the residual stale-scenario 404 console noise after reset as cleanup backlog, not as a blocker to the repaired operator flow.

## Customer TBD tracking

Customer-owned unknowns remain tracked in `docs/BACKLOG.md` as `B-TBD-01..B-TBD-05`.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
