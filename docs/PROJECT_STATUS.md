# Project status

Last updated: 2026-03-15

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36` is completed and accepted.
- Initial setup-wizard rollout `S-37..S-42` is completed, and the corrective queue `S-43..S-47` is now completed and accepted.
- A follow-up live UX audit across the wizard, shell, Forecast, and Reports found a second-tier consistency gap: the product is functionally complete, but the information hierarchy and state messaging still ask too much interpretation from human users.
- The new active queue is `S-48..S-52`, focused on action-first layout, truthful shell state, imported-year-only human summaries, coherent step-2 import messaging, summary demotion, and smoother Forecast/Reports handoff.
- The recent blocker review showed that most interruptions were protocol/scoping failures, not product ambiguity: in-scope pre-existing dirt, same-package verification fallout outside listed `files:`, and gate-tightening substeps that listed only the new test/parity file.
- The OS contract now keeps the end-of-DO/REVIEW clean-tree guarantee but allows auditable scoped dirt absorption, bounded same-package gate fixes, and explicit `HARD BLOCKED` versus `GATE BLOCKED` handling.
- `delegate_autopilot` remains an allowed launcher only inside the existing parent-owned PLAN and DO/RUNSPRINT slots; scope, commits, evidence, and clean-tree checks stay parent-owned.
- The corrective wizard sprint now has both automated regression proof and a Finnish Kronoby re-audit artifact concluding `whole sprint succeeded`.

## Top blockers

1. Step-1 and step-2 still present the wrong visual hierarchy: the non-actionable summary/hero chrome dominates above the actual active form.
2. Shell connection/tab state and human-facing year counts are still looser than the underlying setup truth on direct routes and after resets.
3. Forecast and Reports are functionally unlocked after setup, but the handoff still feels like a second onboarding phase instead of a continuation.
4. Customer-owned `B-TBD-01..B-TBD-05` still remain outside execution scope.

## Next actions

1. Execute `S-48` first so shell truth and reset/direct-route behavior stop contradicting the wizard.
2. Execute `S-49` and `S-50` next so imported-year semantics and action-first layout become coherent together.
3. Finish with `S-51` and `S-52` to smooth the handoff into Forecast/Reports and close with a fresh UX consistency audit.

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
