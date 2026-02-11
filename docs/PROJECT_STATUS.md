# Project status

Last updated: 2026-02-11

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Core budget/import/projection flows exist and remain the V1 base.
- Customer-locked facts are now explicit: VAT-free, manual base fee, no dedicated connection-fee model, minimum 20-year horizon, depreciation split, PDF cashflow export.
- OS contract supports deterministic PLAN/DO/REVIEW execution.
- Sprint state after REVIEW: `S-01=DONE`; `S-02=DONE`; `S-03=DONE`; `S-04=DONE`; `S-05=DONE`.
- `S-02` acceptance verified from commit chain `61bde17..d40c48a` and focused regression runs (API budget 10 passed, API projection 17 passed, web panel 2 passed).

## Top blockers

1. Sprint execution rows are complete (`S-01..S-05=DONE`); focus moves to milestone acceptance lock.
2. Customer-owned TBD items `B-TBD-01..B-TBD-05` remain open for final acceptance lock.
3. Final business signoff and release governance evidence packaging is still pending.

## Next 5 actions

1. Package final acceptance evidence bundle for customer signoff.
2. Resolve `B-TBD-01..B-TBD-05` with customer owners.
3. Run final milestone acceptance review across roadmap done criteria.
4. Confirm release-governance artifacts are archived with commit references.
5. Prepare pilot go-live readiness checkpoint.

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
