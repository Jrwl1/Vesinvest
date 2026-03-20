# Project status

Last updated: 2026-03-20

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The visual-overhaul queue `S-121..S-127` is accepted and closed.
- The current execution target is the post-audit interaction and performance queue `S-128..S-136`.
- The planned implementation is still front-end-led, with bounded backend support only where search/connect/loading truth cannot be fixed in the client alone.
- Customer source material still anchors the product on three real result statements, explicit year review, 20-year investment planning, and depreciation derived from the freshest booked year plus future investments.
- The approved direction is a more professional action-first flow: Vesipolku-specific login, explicit step-back navigation, clearer year-selection buckets, value-led review cards, and in-place year correction instead of detached editors.

## Top blockers

1. Steps 2 and 3 still rely on detached under-card editors with save semantics that feel lossy and non-professional.
2. Step-2 year-selection semantics are misleading: selectable, blocked, excluded, and `not this import` are not clearly separated.
3. First-open and step-1 lookup/connect still feel slower than they should because of cold VEETI search, frontend gate chaining, and eager Overview/year-detail fetches.

## Next actions

1. Execute `S-128..S-136` to ship the post-audit login, wizard, interaction, and performance hardening queue.
2. Preserve manual-vs-VEETI provenance, explicit approval truth, compute freshness, depreciation visibility, and report-readiness gating while reshaping the flow.
3. Replace the current detached step-2 and step-3 editor pattern with shared in-place row editing plus keyboard-safe save/cancel behavior before the next live audit.

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
