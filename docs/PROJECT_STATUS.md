# Project status

Last updated: 2026-03-21

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The residual interaction-truth queue `S-137..S-141` is accepted and closed.
- The current execution target is the `OverviewPageV2` decomposition queue `S-142..S-148`.
- The planned implementation remains front-end-led and behavior-preserving: extract structure first, keep the current V2 API contract and user-visible workflow truth intact unless an execution blocker proves a minimal same-area support change is required.
- Customer source material still anchors the product on three real result statements, explicit year review, 20-year investment planning, and depreciation derived from the freshest booked year plus future investments.
- The approved direction is structural now: keep the accepted shell and wizard behavior, but break the current `OverviewPageV2.tsx` monolith into extracted hooks, step components, workflow modules, and shared year-card pieces so further work no longer depends on one 8.7k-line page file.

## Top blockers

1. `apps/web/src/v2/OverviewPageV2.tsx` is about 8.7k lines and still mixes routing, fetch orchestration, wizard state derivation, year-card rendering, manual patch workflows, and import flows in one file.
2. The page has enough intertwined state and render helpers that even small changes still require broad regression confidence and full-file reasoning.
3. The next queue must preserve the just-accepted linked-workspace behavior while extracting code, so behavior drift is a real refactor risk even without product-scope changes.

## Next actions

1. Execute `S-142..S-148` to decompose `OverviewPageV2.tsx` into pure helpers, dedicated hooks, step components, and workflow modules.
2. Preserve manual-vs-VEETI provenance, explicit approval truth, compute freshness, depreciation visibility, and report-readiness gating while shrinking the main page file into an orchestration shell.
3. Re-run focused linked-workspace setup regressions and a live audit after the decomposition lands, not just unit-level extraction tests.

## Customer TBD tracking

Customer-owned unknowns remain tracked in `docs/BACKLOG.md` as `B-TBD-01..B-TBD-05`.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
