# Project status

Last updated: 2026-03-21

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The `OverviewPageV2` decomposition queue `S-142..S-148` is accepted and closed.
- The security/performance remediation queue `S-149..S-155` is accepted, and `S-156` remains `READY` with a deployment-side header-verification blocker.
- Customer source material still anchors the product on three real result statements, explicit year review, 20-year investment planning, and depreciation derived from the freshest booked year plus future investments.
- The repo OS contract now includes a read-only `HUMANAUDIT -> OK GO -> PLAN` intake lane so screenshot/text audits can accumulate code context before sprint docs are rewritten.
- The current V2 workflow remains Overview -> Forecast -> Reports; remediation must preserve explicit approval, provenance, freshness, depreciation visibility, and report-readiness truth while tightening runtime safety and responsiveness.

## Top blockers

1. `S-156` cannot be closed from this workspace until the live frontend edge emits the repo-defined header policy and that state can be re-verified.
2. The active sprint is otherwise at acceptance-gate stage, so the remaining queue risk is deployment verification rather than local implementation scope.

## Next actions

1. Re-verify the deployed frontend edge headers when the required deployment access is available, then close `S-156` if the live state matches the repo contract.
2. Use `HUMANAUDIT` for screenshot/text intake, `OK GO` to freeze and synthesize the findings, and a follow-up `PLAN` run to write any next queue before `RUNSPRINT`.
3. Keep workflow truth stable while any follow-up remediation lands: explicit approval, provenance, compute freshness, depreciation visibility, and report-readiness gating must not drift.

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
