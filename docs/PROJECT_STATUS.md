# Project status

Last updated: 2026-02-11

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Active sprint queue has been rotated to a new executable `S-01..S-05` focused on KVA Excel import customer usability.
- `S-01` is now the top DO item and targets: `KVA totalt` extraction, 3-year preview in app, confirm-write into Talousarvio.
- All sprint rows are currently `TODO`; no DO evidence has been recorded for the new queue yet.
- Prior DONE sprint evidence remains historical and does not define the new execution queue.

## Top blockers

1. Deterministic mapping for the fixture workbook must be locked to `KVA totalt` labels and latest 3 year columns.
2. Preview and confirm proof must show year-by-year extracted totals and persisted Talousarvio rows for chosen org/year/name.
3. Customer TBD items `B-TBD-01..B-TBD-05` are still open for final acceptance lock, but are non-blocking for this sprint start.

## Next 5 actions

1. Execute `S-01` substep 1 (fixture regression proving `KVA totalt` is selected, not `Blad1`).
2. Execute `S-01` substeps for deterministic 3-year extraction and Vatten/Avlopp mapping.
3. Execute `S-01` substeps for preview UI text and year-by-year totals rendering before confirm.
4. Execute `S-01` confirm persistence tests and end-to-end regression proof.
5. Run root gates and record PASS evidence for the `S-01` happy-path proof.

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
