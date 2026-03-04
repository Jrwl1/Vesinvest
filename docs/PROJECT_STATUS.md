# Project status

Last updated: 2026-03-04

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- VEETI import trust sprint S-06..S-10 is completed.
- Forecast/Reports trust hardening sprint **S-11..S-15 is completed** (report consistency + deterministic compute/report flow + scenario switch clarity + safer investments editor + GET cache/force-refresh behavior).
- Sprint **S-16 is completed** (durable VEETI year lifecycle: persisted year exclusions, batch delete/restore, and regression-proof no-resurrection sync behavior).
- Sprint **S-17 is completed** (input-first Forecast UX + validated 5-year+thereafter manual % model).
- Sprint **S-18 is completed** (explicit VA 1/2/3 category routing + dual pricing modes with latest-year comparator surfaced in Forecast/Reports).
- Sprint **S-19 is completed** (depreciation-rule schema/API/UI + class-allocation wiring + fallback compatibility tests validated).
- Sprint **S-20 is completed** (merge-safe update paths + compatibility tests + expanded E2E + staged rollout flags + final root quality gates).

## Top blockers

1. None. Customer TBD items `B-TBD-01..B-TBD-05` remain open and non-blocking.

## Next 5 actions

1. All active sprint rows `S-16..S-20` are now `DONE`; prepare next PLAN cycle for new active sprint items.
2. Keep rollout flag `V2_DEPRECIATION_RULES_ENABLED` default strategy documented before production enablement.
3. Track existing lint warnings as non-blocking technical debt and convert to backlog tasks if they become gate criteria.
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
