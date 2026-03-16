# Project status

Last updated: 2026-03-16

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36`, the wizard rollout/corrective queues `S-37..S-47`, the wizard UX-coherence queue `S-48..S-52`, the power-user Forecast queue `S-53..S-58`, and the wizard trust-first queue `S-59..S-63` are all recorded as completed and accepted.
- Current code and a fresh live audit now disagree with that completed state in one important area: the wizard looks better, but the ready-year review loop is still not operationally complete.
- Step 1 is materially improved and step 2/3 are more truthful, but a technically ready year still cannot be naturally accepted as-is without an edit in the current implementation.
- `handleKeepCurrentYearValues()` currently closes the year surface and shows info, but does not mark the year reviewed; `Tallenna vuoden tiedot` still rejects a no-change review.
- The year-detail surface still frames technically ready years like problem years, still leaks English fallback strings in the Finnish flow, and still shows zero-like placeholders for missing blocked-year values.
- The current year-detail IA exposes comparison, editing, restore, PDF import, and secondary fields too flatly for normal users even though the comparison foundation is now useful for power users.
- The next queue therefore needs to be a focused follow-up implementation queue rather than a generic “pick the next milestone” pass.

## Top blockers

1. The wizard still lacks a true no-change approval path for technically ready years, so the core review loop cannot complete naturally.
2. Ready-year copy, locale fallbacks, and missing-state presentation still undermine user trust in the year-detail surface.
3. Human-first review and secondary power-user controls are not yet layered cleanly enough in step 4.

## Next actions

1. Execute `S-64` to wire no-change review acceptance, reviewed-year progression, and summary updates in the current code.
2. Execute `S-65..S-67` to separate review from edit mode, remove locale/missing-state trust leaks, and rebalance the year-detail surface for human and power-user use.
3. Close with `S-68` by re-running the full steps `1..6` audit from a wiped workspace.

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
