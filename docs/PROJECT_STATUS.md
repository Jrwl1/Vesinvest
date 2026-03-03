# Project status

Last updated: 2026-03-02

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- VEETI import trust sprint S-06..S-10 is completed.
- Forecast/Reports trust hardening sprint **S-11..S-15 is completed** (report consistency + deterministic compute/report flow + scenario switch clarity + safer investments editor + GET cache/force-refresh behavior).
- Sprint **S-16 is completed** (durable VEETI year lifecycle: persisted year exclusions, batch delete/restore, and regression-proof no-resurrection sync behavior).

## Top blockers

1. None. Customer TBD items `B-TBD-01..B-TBD-05` remain open and non-blocking.

## Next 5 actions

1. Run root quality gates (`pnpm lint`, `pnpm typecheck`, `pnpm test`) before release packaging.
2. Perform live UAT pass on Forecast + Reports to confirm trust fixes in production behavior.
3. Execute next sprint target `S-17` from `docs/SPRINT.md` (Forecast input-first UX + 5-year+thereafter manual % model).
4. Capture any newly observed scope gaps in `docs/BACKLOG.md`.
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
