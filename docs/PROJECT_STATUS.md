# Project status

Last updated: 2026-02-11

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Canonical planning has been reset to a new executable sprint queue for runtime stability and release-gate hardening.
- Top execution focus is now `S-01`: BudgetPage hook-order crash (`Rendered more hooks than previous render`).
- Sprint state after PLAN: `S-01..S-05=TODO`.
- Prior sprint completion remains historical evidence; new queue is the active DO source of truth.

## Top blockers

1. BudgetPage can crash on hard reload when render paths differ between `rivit` and `valisummat`-only payloads.
2. Root gates are not yet re-validated as hard-green in current queue (`pnpm lint`, `pnpm typecheck`, `pnpm release-check`).
3. Customer-owned TBD items `B-TBD-01..B-TBD-05` remain open for final acceptance lock.

## Next 5 actions

1. Execute `DO` for `S-01` substep 1 (add failing `rivit` regression test for hooks-order crash).
2. Complete `S-01` substeps 2-6 and reach warning-free BudgetPage render behavior.
3. Execute `S-02` to stabilize `rivit` and `valisummat`-only payload handling.
4. Execute `S-03` and `S-04` to restore deterministic root lint/typecheck green runs.
5. Execute `S-05` to enforce deterministic `release-check` gate ordering and full PASS evidence.

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
