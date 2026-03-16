# Project status

Last updated: 2026-03-16

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36`, the wizard rollout/corrective queues `S-37..S-47`, the wizard UX-coherence queue `S-48..S-52`, and the power-user Forecast queue `S-53..S-58` are all completed and accepted.
- `S-59` is completed and accepted: step 1 now offers assisted lookup with debounced suggestions, a shorter connect path, and a bounded tenant-authenticated backend search flow tuned for typeahead usage.
- `S-60` is completed and accepted: technical completeness is now kept separate from human review, reviewed-year state persists across reload inside the workspace, and step-3 handoff no longer treats technical readiness as implicit approval.
- The shipped wizard is structurally cleaner than the old Overview flow: step 1 is action-first, step 2 splits importable versus repair-only years, shell truth follows setup truth, Forecast/Reports no longer bypass setup, step-1 lookup no longer depends on explicit button-only search, and planning-baseline gating now depends on explicit review rather than on raw sync completeness alone.
- Current step-2 and step-3 year surfaces still lead with dataset counts instead of recognizable business values, so users cannot quickly confirm that a VEETI year looks like their own before moving on.
- Current year editing is still a blocked-year-first modal built from `effectiveRows`; raw VEETI baseline values and per-section override clarity remain secondary.
- The remaining trust-first queue is now centered on year-card clarity and shared year-detail review/editing, not on lookup or review-state truth anymore.

## Top blockers

1. Step-2 and step-3 year surfaces still lead with dataset counts instead of recognizable business values.
2. Ready imported years still lack explicit per-year open/review actions in the step-3 list.
3. The current year-detail surface is overloaded and makes raw VEETI versus effective values harder to verify than they should be.

## Next actions

1. Execute `S-61` to replace row-count-first year cards with recognizable value previews and give ready imported years explicit review actions.
2. Execute `S-62` to unify ready/blocked/excluded year review/editing around one shared detail surface with raw-versus-effective clarity.
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
