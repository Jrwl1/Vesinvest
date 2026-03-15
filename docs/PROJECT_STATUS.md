# Project status

Last updated: 2026-03-15

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36` is completed and accepted.
- Initial setup-wizard rollout `S-37..S-42` is completed, and the corrective queue `S-43..S-47` is now completed and accepted.
- The follow-up UX-coherence queue `S-48..S-52` is completed and accepted.
- The fresh live audit artifact in `docs/WIZARD_UX_CONSISTENCY_AUDIT.md` concludes `whole sprint succeeded`.
- The delivered V2 flow now shows action-first step surfaces, truthful shell state on direct routes and after reset, imported-only human year summaries, a split step-2 import/repair hierarchy, and a coherent Forecast/Reports continuation after setup.
- `S-53` is now completed and accepted, so Forecast command-strip actions, Forecast body readiness, and zero-report Reports guidance all reuse one compute/report truth model.
- `S-54` is now completed and accepted, so the selected scenario opens to a compact result-statement cockpit with five pillar cards and derived result rows ahead of the longer editing surfaces.
- `S-55` is now completed and accepted, so `Intakter`, `Materialkostnader`, `Personalkostnader`, and `Ovriga rorelsekostnader` each have dedicated drill-down workbenches, and analyst mode keeps dense yearly editing inside those focused surfaces.
- `S-56` is now completed and accepted, so depreciation storage, compute input, and API contracts are scenario-scoped, baseline versus new-investment depreciation are stored separately, and the backend accepts `straight-line` plus `custom annual schedule` rules.
- `S-57` is now completed and accepted, so the `Avskrivningar` workspace exposes baseline/new/total depreciation preview, one-to-one category mapping, unmapped-state visibility, and report blocking until depreciation mapping is complete.
- `S-58` is now completed and accepted, so statement-native comparison and the final audit artifact are in place, and `docs/ENNUSTE_POWER_USER_AUDIT.md` concludes `whole sprint succeeded`.
- Customer direction now shifts the next execution queue away from onboarding clarity and toward a power-user `Ennuste` workbench shaped around resultatrakning structure.
- Current code already contains scenario lifecycle, near-term opex editing, fee-sufficiency metrics, risk presets, org-level depreciation rules, and scenario-year class allocations; the next queue will refactor and migrate those pieces instead of replacing Forecast wholesale.
- The OS contract now keeps the end-of-DO/REVIEW clean-tree guarantee but allows auditable scoped dirt absorption, bounded same-package gate fixes, and explicit `HARD BLOCKED` versus `GATE BLOCKED` handling.
- `delegate_autopilot` remains an allowed launcher only inside the existing parent-owned PLAN and DO/RUNSPRINT slots; scope, commits, evidence, and clean-tree checks stay parent-owned.
- The recent execution interruptions were protocol/scoping issues rather than product ambiguity, and the current OS rules now cover the cases that caused those stops.

## Top blockers

1. Customer-owned `B-TBD-01..B-TBD-05` still remain outside execution scope.
2. Release/deployment/security backlog items outside the Forecast sprint remain open.
3. The next post-sprint execution queue has not been rotated yet.

## Next actions

1. Run `PLAN` to rotate the next execution queue now that `S-53..S-58` is accepted.
2. Keep the accepted Forecast cockpit stable while the next queue is defined.
3. Fold explicit locale entries for the newer Forecast workspaces into a follow-up polish pass if they remain user-visible.

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
