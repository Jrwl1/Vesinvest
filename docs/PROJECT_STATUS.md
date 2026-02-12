# Project status

Last updated: 2026-02-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Sprint queue replaced with new S-01..S-05 plan: KVA Excel import and Talousarvio correctness (sign convention, 3-year bucket+breakdown, no tuloajurit on Talousarvio, result calculation guardrails).
- All S-01..S-05 Status: TODO. Next: DO executes first unchecked substep of S-01.

## Top blockers

1. Talousarvio tab must show only imported historical data and derived result; tuloajurit and computed revenue row must be removed/disabled from Talousarvio (planned in S-04).
2. KVA confirm currently single-year; must create/update one budget per extracted year and remove Vuosi selector (S-03, S-04).
3. Customer TBD items `B-TBD-01..B-TBD-05` remain open and are non-blocking unless a sprint Stop is triggered.

## Next 5 actions

1. DO S-01: lock sign convention (Option A), normalize import storage, add regression test (expense/poisto/investointi never increase result).
2. DO S-02: KVA parser 3 historical years, bucket totals + breakdown, exclude Förändring/result rows, missing bucket = 0.
3. DO S-03: Preview bucket-first expandable; remove Vuosi selector; remove tuloajurit/template warnings; confirm sends 3 years.
4. DO S-04: API 3-year confirm (one budget per year); persist breakdown; Talousarvio no tuloajurit, result from valisummat only.
5. DO S-05: E2E verification, sign/type regression, root gates; final smoke Talousarvio correct.

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
