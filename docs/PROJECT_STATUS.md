# Project status

Last updated: 2026-02-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Sprint rotated to Talousarvio locked-in plan (S-01..S-05): schema + import batch + Källa (S-01), API for budget sets (S-02), Talousarvio 3 year cards + 4 buckets + per-bucket expand + Källa (S-03), KVA Import year selector + preview per-bucket + Diagnostiikka + confirm i18n (S-04), validation + i18n + gates (S-05). All five rows TODO.
- Previous S-01..S-05 (KVA correctness) DONE; evidence in WORKLOG.

## Top blockers

1. None. Customer TBD items `B-TBD-01..B-TBD-05` remain open and non-blocking.

## Next 5 actions

1. DO: execute first unchecked substep of S-01 (schema + migration + confirm batch/Källa).
2. Keep root gates green (pnpm lint, typecheck, test).
3. Backlog: B-611 (Forecast/Ennuste tuloajurit re-enable) when Talousarvio historical-only is accepted.
4. Optional: manual smoke after S-03 — Talousarvio shows 3 year cards, 4 buckets, Källa.
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
