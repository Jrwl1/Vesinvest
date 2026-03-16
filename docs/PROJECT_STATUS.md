# Project status

Last updated: 2026-03-16

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36`, the wizard rollout/corrective queues `S-37..S-47`, the wizard UX-coherence queue `S-48..S-52`, and the power-user Forecast queue `S-53..S-58` are all completed and accepted.
- `S-59` is completed and accepted: step 1 now offers assisted lookup with debounced suggestions, a shorter connect path, and a bounded tenant-authenticated backend search flow tuned for typeahead usage.
- The shipped wizard is structurally cleaner than the old Overview flow: step 1 is action-first, step 2 splits importable versus repair-only years, shell truth follows setup truth, Forecast/Reports no longer bypass setup, and step-1 lookup no longer depends on explicit button-only search.
- Current step-2 and step-3 year surfaces still lead with dataset counts instead of recognizable business values, so users cannot quickly confirm that a VEETI year looks like their own before moving on.
- Current year editing is still a blocked-year-first modal built from `effectiveRows`; raw VEETI baseline values and per-section override clarity remain secondary.
- The remaining trust-first queue is now centered on year semantics and year-detail review/editing, not on step-1 lookup anymore.

## Top blockers

1. The wizard still conflates technical sync-readiness with human trust/approval of a year.
2. Step-2 and step-3 year surfaces still lead with dataset counts instead of recognizable business values.
3. The current year-detail surface is overloaded and makes raw VEETI versus effective values harder to verify than they should be.

## Next actions

1. Execute `S-60` to separate `technical ready` from `reviewed` and make that state survive reload/reset truthfully.
2. Execute `S-61..S-62` to expose recognizable year values and unify ready/blocked/excluded year review/editing around one shared detail surface.
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
