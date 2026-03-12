# Project status

Last updated: 2026-03-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36` is completed and accepted.
- Initial setup-wizard rollout `S-37..S-42` is completed, but live audit plus code review showed the refactor is not structurally finished.
- Corrective queue `S-43..S-47` remains the active execution target, now patched with explicit backend cleanup, active-step contract work, CTA ownership, and a final Finnish re-audit closeout.
- The OS contract now treats `delegate_autopilot` as the allowed launcher for read-only PLAN research and the single DO/RUNSPRINT implementation slot, while keeping required reads, scope, commits, evidence, and clean-tree checks parent-owned.
- Current backend still carries legacy sync semantics (`veeti-sync` connect behavior, `/import/sync`, empty-input baseline fallback, and reset semantics) that must be retired or redefined for the wizard to be truthful.
- Current frontend still needs one authoritative active-step contract, removal of obsolete wizard logic, and shell/body alignment on the same active state.
- Wizard i18n still needs broader chrome coverage and hard parity enforcement for wizard key families.

## Top blockers

1. Backend/API must separate and persist `workspaceYears`, clean every downstream consumer of raw available years, and retire legacy sync semantics that still blur connect vs import.
2. Frontend must move to one authoritative active-step contract, including selected problem-year state and explicit `review continue` / step-4 routing.
3. `OverviewPageV2` must remove the stacked legacy setup layout and re-enforce the one-primary-CTA-per-active-step rule.
4. The sprint is not complete until a fresh Finnish Kronoby UI/UX re-audit explicitly records `whole sprint succeeded` or `stopped by blocker: ...`.

## Next actions

1. Resume `S-43` under the hardened DO/RUNSPRINT contract, using `delegate_autopilot` only inside the selected substep slot when it materially helps, and clear the backend workspace-year split, sync-layer behavior, baseline fallback, and reset semantics.
2. Execute `S-44` and `S-45` to align shell/body state and remove obsolete stacked surfaces and CTA duplication.
3. Execute `S-46` and `S-47` to close all wizard chrome translation gaps and end with the Finnish Kronoby re-audit artifact.

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
