# Project status

Last updated: 2026-03-08

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Forecast/Reports trust hardening sprint `S-11..S-20` remains completed.
- Sprint `S-21..S-25` is completed for statement import, trusted-year review, effective-baseline Forecast, fee/risk outputs, and report variants.
- Active UI refresh queue is variable-length; the current active rows are `S-26..S-30`.
- `S-26` is `DONE`: Overview now uses the refreshed trust-review layout with accepted evidence and regression proof.
- `S-27` is `DONE`: Forecast now uses the refreshed editor-first layout with accepted evidence and regression proof.
- `S-28` is `DONE`: Reports now uses the refreshed publication/provenance layout with accepted evidence and regression proof.
- `S-29..S-30` remain queued for shared alignment and final hardening.

## Top blockers

1. Customer-owned `B-TBD-01..B-TBD-05` remain unresolved but non-blocking.
2. No active protocol blocker is open in the current sprint queue.
3. Continuous `DO -> REVIEW` execution may continue until all active sprint rows are `DONE` unless a stop condition is hit; `RUNSPRINT` is now the explicit whole-sprint entry command.

## Next actions

1. Continue execution from `S-29` substep 1 in `docs/SPRINT.md` using `DO` or explicit whole-sprint `RUNSPRINT`.
2. Keep `S-28..S-30` as the next queued rows behind the active Forecast work.
3. Keep customer TBDs `B-TBD-01..B-TBD-05` tracked as non-blocking.
4. Preserve the shipped statement-import, trusted-baseline, and structured investment flow while the UI refresh advances.
5. Keep root quality gates green as the active sprint queue moves toward `DONE`.

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
