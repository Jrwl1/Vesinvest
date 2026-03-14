# Project status

Last updated: 2026-03-14

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36` is completed and accepted.
- Initial setup-wizard rollout `S-37..S-42` is completed, but the corrective queue `S-43..S-47` remains the active execution target until the Finnish re-audit closes the sprint explicitly.
- The recent blocker review showed that most interruptions were protocol/scoping failures, not product ambiguity: in-scope pre-existing dirt, same-package verification fallout outside listed `files:`, and gate-tightening substeps that listed only the new test/parity file.
- The OS contract now keeps the end-of-DO/REVIEW clean-tree guarantee but allows auditable scoped dirt absorption, bounded same-package gate fixes, and explicit `HARD BLOCKED` versus `GATE BLOCKED` handling.
- `delegate_autopilot` remains an allowed launcher only inside the existing parent-owned PLAN and DO/RUNSPRINT slots; scope, commits, evidence, and clean-tree checks stay parent-owned.
- Current product work still needs the remaining Finnish wizard regression proof and the final Kronoby re-audit closeout in `S-46..S-47`.

## Top blockers

1. `S-46` and `S-47` still need to be finished and accepted before the wizard corrective sprint can close.
2. Remaining execution must use the new gate-aware sprint authoring rule so regression/parity-tightening substeps include the likely same-package implementation files up front.
3. Remaining execution must now prove the new scoped-baseline, same-package gate-fix, hygiene-check, and blocker-taxonomy rules behave as intended in live `S-46..S-47` runs.
4. The sprint is not complete until a fresh Finnish Kronoby UI/UX re-audit explicitly records `whole sprint succeeded` or `stopped by blocker: ...`.

## Next actions

1. Finish `S-46` under the hardened gate-aware contract, with the pending Finnish regression substep allowed to touch the wizard implementation and locale files it is meant to verify.
2. Run `S-47` with the widened regression substep scopes so same-package fallout can be fixed without stopping on avoidable gate mismatches.
3. End the queue with the Finnish Kronoby re-audit artifact and an explicit sprint outcome statement.

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
