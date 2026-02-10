# Project status

Last updated: 2026-02-10

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Core budget/import/projection flows exist and remain the V1 base.
- Customer-locked facts are now explicit: VAT-free, manual base fee, no dedicated connection-fee model, minimum 20-year horizon, depreciation split, PDF cashflow export.
- AI OS contract is being hardened so future runs can be triggered by PLAN/DO/REVIEW only.

## Top blockers

1. Customer has not answered remaining business questions needed to finalize acceptance thresholds.
2. Sprint execution format was ambiguous and required strict Do/Files/Acceptance/Evidence normalization.
3. Decision log contains historical pending notes that can be misread without a superseding note.

## Next 5 actions

1. Finalize AGENTS/CANONICAL contract for deterministic PLAN/DO/REVIEW routing.
2. Normalize sprint to 5 executable DO items with explicit evidence requirements.
3. Reconcile canonical conflicts in CANONICAL_REPORT and DECISIONS.
4. Keep roadmap/backlog aligned with customer-locked V1 facts only.
5. Close remaining customer TBD items (Owner: Customer) and move them to acceptance lock.

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
