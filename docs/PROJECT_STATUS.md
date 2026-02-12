# Project status

Last updated: 2026-02-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Sprint rotated to KVA import lockdown (S-01..S-05): UI (2 decimals, €, Tulot green/Kulut red) + single-source KVA totalt only + tests + docs/KVA_IMPORT_LOCKDOWN.md. Previous Talousarvio sprint S-01..S-05 DONE (evidence in WORKLOG).

## Top blockers

1. None. Customer TBD items `B-TBD-01..B-TBD-05` remain open and non-blocking.

## Next 5 actions

1. DO: first unchecked substep of S-01 (underrow 2 decimals + € symbol).
2. Keep root gates green (pnpm lint, typecheck, test).
3. Backlog: B-611 (Forecast/Ennuste tuloajurit re-enable) when Talousarvio historical-only is accepted.
4. Optional: manual smoke after S-03 — KVA preview shows one row per category per year (no duplicates).
5. Align M0 done criteria with customer if needed.

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
