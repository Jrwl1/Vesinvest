# Project status

Last updated: 2026-02-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- KVA import + Talousarvio baseline decisions are locked.
- **Ennuste sprint complete:** S-01..S-05 marked DONE (driver override API, DriverPlanner UI, compute wiring, Diagram sub-view, regression + root gates). Ennuste page is fully working per `docs/PROJECTION_UX_PLAN.md`.

## Top blockers

1. None. Customer TBD items `B-TBD-01..B-TBD-05` remain open and non-blocking.

## Next 5 actions

1. PLAN: Rotate sprint to next milestone scope or refine M0 done criteria.
2. Keep root gates green (`pnpm lint`, `pnpm typecheck`, `pnpm test`).
3. Backlog tracking: `B-615` closed via Ennuste sprint; `B-611` dependency satisfied.
4. Optional manual smoke: Ennuste scenario → horizon → driver inputs → compute → Taulukko/Diagrammi.
5. Customer TBDs: `B-TBD-01..B-TBD-05` remain open and non-blocking.

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
