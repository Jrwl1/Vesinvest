# Project status

Last updated: 2026-02-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Sprint queue rotated to fresh executable S-01..S-05 for KVA import historical baseline flow.
- S-01..S-05 READY (DO complete). Next: REVIEW to mark DONE.

## Top blockers

1. API and UI contracts still contain legacy KVA import fields (`revenueDrivers`, `accountLines`) that must be removed from default KVA flow.
2. Talousarvio page still has tuloajurit-derived rendering paths; historical import must not depend on driver inputs.
3. Customer TBD items `B-TBD-01..B-TBD-05` remain open for final acceptance lock and are non-blocking for sprint execution.

## Next 5 actions

1. Execute S-01: lock parser behavior for first 3 historical years from `KVA totalt` with fixture-backed proof.
2. Execute S-02: complete atomic scoped mapping and remove default KVA preview branches for Tuloajurit and Blad1 rows.
3. Execute S-03: ship preview UX with per-year cards and expand details before confirm.
4. Execute S-04: ensure confirm apply writes correct Talousarvio baseline and remove Talousarvio dependency on drivers.
5. Execute S-05: end-to-end proof plus hard gates (`pnpm lint`, `pnpm typecheck`, `pnpm release-check`).

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
