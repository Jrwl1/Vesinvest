# Project status

Last updated: 2026-03-02

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- VEETI import trust sprint S-06..S-10 is completed.
- New active sprint is **Forecast/Reports trust hardening** (`S-11..S-15`) covering report consistency, compute/report gating, scenario loading clarity, safer investment editing, and API request deduplication.

## Top blockers

1. None. Customer TBD items `B-TBD-01..B-TBD-05` remain open and non-blocking.

## Next 5 actions

1. Execute `S-11` first unchecked substep in `docs/SPRINT.md`.
2. Continue deterministic `DO` + `REVIEW` until `S-11..S-15` are `DONE`.
3. Keep root gates green (`pnpm lint`, `pnpm typecheck`, `pnpm test`).
4. Capture any confirmed scope gap in `docs/BACKLOG.md` (no ad-hoc scope drift in DO).
5. Keep customer TBDs `B-TBD-01..B-TBD-05` tracked as non-blocking.

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
