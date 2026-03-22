# Project status

Last updated: 2026-03-22

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The security/performance remediation queue `S-149..S-155` is accepted, and `S-156` remains `READY` as a deployment-only header-verification hold.
- The HUMANAUDIT-derived frontend trust/interaction queue `S-157..S-165` is accepted history, and the current local execution target is now the year-card copy/layout cleanup queue `S-166..S-167`.
- Customer source material still anchors the product on three real result statements, explicit year review, 20-year investment planning, and depreciation derived from the freshest booked year plus future investments.
- The current V2 workflow remains Overview -> Forecast -> Reports; the new queue must preserve explicit approval, provenance, freshness, depreciation visibility, and report-readiness truth while removing result-commentary slop and hardening compact tile fit.

## Top blockers

1. `S-156` cannot be closed from this workspace until the live frontend edge emits the repo-defined header policy and that state can be re-verified.
2. Imported year cards still render low-value result commentary under the card, and compact secondary tiles can still break on Finnish labels such as `Jäteveden hinta`.

## Next actions

1. Re-verify the deployed frontend edge headers when the required deployment access is available, then close `S-156` if the live state matches the repo contract.
2. Execute `S-166..S-167`: remove the result-commentary block, fix compact tile fit, and close with a focused live re-audit.

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
