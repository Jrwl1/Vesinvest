# Project status

Last updated: 2026-03-16

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36`, the wizard rollout/corrective queues `S-37..S-47`, the wizard UX-coherence queue `S-48..S-52`, and the power-user Forecast queue `S-53..S-58` are all completed and accepted.
- The shipped wizard is structurally cleaner than the old Overview flow: step 1 is action-first, step 2 splits importable versus repair-only years, shell truth follows setup truth, and Forecast/Reports no longer bypass setup.
- A fresh live wizard audit on 2026-03-16 still found a trust gap inside steps 1-4: company lookup remains explicit-search-only, technically ready years are marked `Valmis` without exposing their actual contents, and ready years are less reviewable than blocked years.
- Current step-2 and step-3 year surfaces still lead with dataset counts instead of recognizable business values, so users cannot quickly confirm that a VEETI year looks like their own before moving on.
- Current year editing is still a blocked-year-first modal built from `effectiveRows`; raw VEETI baseline values and per-section override clarity remain secondary.
- Current backend org search is app-authenticated rather than public-browser VEETI access, so assisted lookup is feasible, but the existing VEETI scan strategy is alphabetically paged and capped, which must be handled in the same queue.
- The next execution queue is therefore a wizard trust-first queue, not another Forecast queue.

## Top blockers

1. The wizard still conflates technical sync-readiness with human trust/approval of a year.
2. Step-1 lookup still requires manual search behavior and the backend search path is not yet hardened for reliable typeahead.
3. The current year-detail surface is overloaded and makes raw VEETI versus effective values harder to verify than they should be.

## Next actions

1. Execute `S-59` to add assisted org lookup and backend-safe search behavior for step 1.
2. Execute `S-60..S-62` to separate `technical ready` from `reviewed`, expose recognizable year values, and unify ready/blocked year review/editing.
3. Close with `S-63` regressions plus a fresh live wizard trust audit before rotating the queue again.

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
