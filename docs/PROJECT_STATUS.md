# Project status

Last updated: 2026-02-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Sprint queue S-01..S-05 for KVA import. S-01 DONE, S-02 DONE (confirm: upsert per year, hierarchy preserved, totals-only).
- Next: S-03 modal redesign; S-04 regression tests; S-05 happy-path proof.

## Top blockers

1. Historical-year detection by sheet styling may be unreliable across workbooks; fallback rule must be deterministic.
3. Customer TBD items `B-TBD-01..B-TBD-05` remain open for final acceptance lock, non-blocking for this sprint start.

## Next 5 actions

1. S-01 DONE, S-02 DONE. Execute S-03 to remove Tuloajurit and Blad1 from KVA modal and show per-year totals preview.
3. Execute S-04 regression coverage for parser, mapping, and modal behavior.
4. Execute S-05 happy-path proof and root gates (`pnpm lint`, `pnpm typecheck`, `pnpm release-check`).

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
