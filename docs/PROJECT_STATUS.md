# Project status

Last updated: 2026-03-15

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36` is completed and accepted.
- Initial setup-wizard rollout `S-37..S-42` is completed, and the corrective queue `S-43..S-47` is now completed and accepted.
- The recent blocker review showed that most interruptions were protocol/scoping failures, not product ambiguity: in-scope pre-existing dirt, same-package verification fallout outside listed `files:`, and gate-tightening substeps that listed only the new test/parity file.
- The OS contract now keeps the end-of-DO/REVIEW clean-tree guarantee but allows auditable scoped dirt absorption, bounded same-package gate fixes, and explicit `HARD BLOCKED` versus `GATE BLOCKED` handling.
- `delegate_autopilot` remains an allowed launcher only inside the existing parent-owned PLAN and DO/RUNSPRINT slots; scope, commits, evidence, and clean-tree checks stay parent-owned.
- The corrective wizard sprint now has both automated regression proof and a Finnish Kronoby re-audit artifact concluding `whole sprint succeeded`.

## Top blockers

1. No active execution blocker remains in the corrective wizard queue.
2. The next planning pass must choose the next active sprint after the completed `S-43..S-47` queue.
3. Customer-owned `B-TBD-01..B-TBD-05` still remain outside execution scope.

## Next actions

1. Run a new `PLAN` pass to define the next active queue after the completed corrective wizard sprint.
2. Decide whether follow-up doc refresh work (`B-1109`, `B-1110`) should enter the next sprint or stay backlog-only.
3. Continue milestone planning beyond M0 now that the wizard corrective closure is accepted.

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
