# Project status

Last updated: 2026-03-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36` is completed and accepted.
- Initial setup-wizard rollout `S-37..S-42` is completed, but live audit plus code review showed the refactor is not structurally finished.
- Corrective queue `S-43..S-47` is now the active execution target.
- Current code still conflates raw available VEETI years with explicitly imported workspace years, so connect can immediately show imported years and jump the wizard to step 4.
- Current `overviewWorkflow` state skips step 3 entirely, and `OverviewPageV2` still mounts legacy import, review, and baseline surfaces in parallel instead of one active step body at a time.
- Wizard i18n is incomplete: wrong keys and missing locale entries still leak English defaults in the Finnish flow.

## Top blockers

1. Backend/API do not persist a separate `workspaceYears` concept for step-2 imports.
2. Wizard progression is not truthful until imported-year counts, blocked-year counts, and review/fix routing derive from explicit workspace years only.
3. `OverviewPageV2` still carries the legacy stacked setup layout, so the first window is not yet a true one-question-at-a-time wizard.
4. Locale integrity coverage does not currently fail on missing `v2Overview` wizard keys.

## Next actions

1. Execute `S-43` to split available VEETI years from persisted workspace-imported years.
2. Execute `S-44` and `S-45` to repair step progression and remove the stacked legacy surfaces.
3. Execute `S-46` and `S-47` to close locale leaks and lock the fixed Kronoby flow with regression and smoke evidence.

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
