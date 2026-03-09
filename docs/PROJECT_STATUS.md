# Project status

Last updated: 2026-03-08

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Forecast/Reports trust hardening sprint `S-11..S-20` remains completed.
- Sprint `S-21..S-25` is completed for statement import, trusted-year review, effective-baseline Forecast, fee/risk outputs, and report variants.
- Active UI refresh queue `S-26..S-30` is fully executed and accepted.
- `S-26` is `DONE`: Overview now uses the refreshed trust-review layout with accepted evidence and regression proof.
- `S-27` is `DONE`: Forecast now uses the refreshed editor-first layout with accepted evidence and regression proof.
- `S-28` is `DONE`: Reports now uses the refreshed publication/provenance layout with accepted evidence and regression proof.
- `S-29` is `DONE`: shared shell alignment, badge semantics, locale copy, responsive cleanup, and the missed style-hack cleanup are accepted.
- `S-30` is `DONE`: keyboard focus, state-surface messaging, regression proof, cleanup, final web verification, and root quality gates are accepted.

## Top blockers

1. Customer-owned `B-TBD-01..B-TBD-05` remain unresolved but non-blocking.
2. No active protocol blocker is open.
3. The current active sprint queue is complete; next execution should start from a new `PLAN` pass.

## Next actions

1. Run `PLAN` to define the next active queue now that `S-26..S-30` are complete.
2. Keep customer TBDs `B-TBD-01..B-TBD-05` tracked as non-blocking.
3. Preserve the shipped statement-import, trusted-baseline, and refreshed V2 Overview/Forecast/Reports flow as the new baseline.
4. Keep root quality gates green in subsequent work.

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
