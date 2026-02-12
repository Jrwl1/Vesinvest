# Project status

Last updated: 2026-02-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Sprint queue has been rotated to a new executable `S-01..S-05` for corrected KVA import behavior.
- Current product behavior already reads subtotal totals from `KVA totalt`; Blad1 is account-level tier only.
- Re-plan target: import only 3 historical years, ignore forecast/prognosis years, ignore `Förändring i...` rows, remove modal Tuloajurit and Blad1 account-row section.
- All rows in the new queue are `TODO`; first executable DO step is `S-01` parser-year filtering.

## Top blockers

1. Historical-year detection by sheet styling may be unreliable across workbooks; fallback rule must be deterministic.
2. Confirm mapping must be redesigned from single-year payload to per-year Talousarvio create/update semantics without regressions.
3. Customer TBD items `B-TBD-01..B-TBD-05` remain open for final acceptance lock, non-blocking for this sprint start.

## Next 5 actions

1. Execute S-01 to lock parser logic for 3 historical years from `KVA totalt`.
2. Execute S-02 to deliver per-year confirm-write mapping into Talousarvio.
3. Execute S-03 to remove Tuloajurit and Blad1 account rows from KVA modal and show per-year totals preview.
4. Execute S-04 regression coverage for parser, mapping, and modal behavior.
5. Execute S-05 happy-path proof and root gates (`pnpm lint`, `pnpm typecheck`, `pnpm release-check`).

## Customer TBD tracking

Customer-owned unknowns are tracked in `docs/BACKLOG.md` as `B-TBD-01..B-TBD-05`.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
