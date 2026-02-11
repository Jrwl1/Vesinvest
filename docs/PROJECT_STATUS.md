# Project status

Last updated: 2026-02-11

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Canonical planning has been reset to a new executable sprint queue for runtime stability and release-gate hardening.
- `S-01` hook-order crash fix is acceptance-verified and moved to `DONE`.
- Sprint state after REVIEW: `S-01=DONE`, `S-02=DONE`, `S-03=DONE`; `S-04..S-05=TODO`.
- Prior sprint completion remains historical evidence; new queue is the active DO source of truth.

## Top blockers

1. Root gates are not yet re-validated as hard-green in current queue (`pnpm lint`, `pnpm typecheck`, `pnpm release-check`).
3. Customer-owned TBD items `B-TBD-01..B-TBD-05` remain open for final acceptance lock.

## Next 5 actions

1. Execute `DO` for `S-04` to restore deterministic root typecheck green state.
2. Execute `S-05` to enforce deterministic `release-check` gate ordering and full PASS evidence.
3. Re-validate root gates (`pnpm lint`, `pnpm typecheck`, `pnpm release-check`) after S-04.
4. Customer TBD items B-TBD-01..B-TBD-05 for final acceptance lock.

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
