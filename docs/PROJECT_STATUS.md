# Project status

Last updated: 2026-03-23

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The security/performance remediation queue `S-149..S-155` is accepted, and `S-156` remains `READY` as a deployment-only header-verification hold.
- The HUMANAUDIT-derived frontend trust/interaction queue `S-157..S-163` is now accepted, including Finnish-first unauthenticated login entry, login-screen language selector, and FI/SV/EN login copy cleaned of workflow-jargon.
- Customer source material still anchors the product on three real result statements, explicit year review, 20-year investment planning, and depreciation derived from the freshest booked year plus future investments.
- The current V2 workflow remains Overview -> Forecast -> Reports; the new queue must preserve explicit approval, provenance, freshness, depreciation visibility, and report-readiness truth while reducing trust-breaking UI friction.

## Top blockers

1. `S-156` cannot be closed from this workspace until the live frontend edge emits the repo-defined header policy and that state can be re-verified.
2. No further local blocker remains in the current queue; any new UI issue now needs a fresh `HUMANAUDIT -> OK GO -> PLAN` cycle before execution.

## Next actions

1. Re-verify the deployed frontend edge headers when the required deployment access is available, then close `S-156` if the live state matches the repo contract.
2. Keep using `HUMANAUDIT` for new screenshot/video findings and only reopen the queue through `PLAN` when a real new frontend scope gap is confirmed.

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
