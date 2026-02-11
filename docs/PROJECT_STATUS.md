# Project status

Last updated: 2026-02-11

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Canonical planning has been reset to a new executable sprint queue for runtime stability and release-gate hardening.
- `S-01` hook-order crash fix is acceptance-verified and moved to `DONE`.
- Sprint state after REVIEW: `S-01=DONE`, `S-02=DONE`, `S-03=DONE`, `S-04=DONE`, `S-05=DONE`.
- Prior sprint completion remains historical evidence; new queue is the active DO source of truth.

## Top blockers

1. Root gates re-validated: `pnpm lint`, `pnpm typecheck`, `pnpm release-check` all pass (S-03, S-04, S-05).
3. Customer-owned TBD items `B-TBD-01..B-TBD-05` remain open for final acceptance lock.

## Next 5 actions

1. Customer TBD items B-TBD-01..B-TBD-05 for final acceptance lock.
2. All five sprint items S-01..S-05 are DONE; next planning cycle can refill sprint from backlog.

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
