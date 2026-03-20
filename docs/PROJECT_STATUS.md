# Project status

Last updated: 2026-03-20

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The post-audit interaction and performance queue `S-128..S-136` is accepted and closed.
- The current execution target is the residual interaction-truth queue `S-137..S-141`.
- The planned implementation remains front-end-led, with bounded backend support only where row-save churn, prefetch scope, or lookup truth cannot be fixed in the client alone.
- Customer source material still anchors the product on three real result statements, explicit year review, 20-year investment planning, and depreciation derived from the freshest booked year plus future investments.
- The approved direction is narrower now: keep the new shell and wizard structure, but finish the remaining professional-fit gaps in row editing, row save behavior, review-surface composition, linked-workspace prefetch, and login hierarchy.

## Top blockers

1. Step 2 still opens a whole-card all-fields editor under the card instead of editing the clicked row where it sits.
2. Step 3 still opens a second review surface under the card instead of staying card-native.
3. Row save via `Enter` works, but it still triggers heavier Overview reload and step jump behavior than the interaction warrants.

## Next actions

1. Execute `S-137..S-141` to close the residual interaction-truth gaps left after `S-128..S-136`.
2. Preserve manual-vs-VEETI provenance, explicit approval truth, compute freshness, depreciation visibility, and report-readiness gating while tightening the remaining row-level UX.
3. Re-audit the linked-workspace login -> step 3 -> save/edit path after those residual fixes land, not only the fresh-org path.

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
