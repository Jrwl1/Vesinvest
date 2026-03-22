# Project status

Last updated: 2026-03-23

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The security/performance remediation queue `S-149..S-155` is accepted, and `S-156` remains `READY` as a deployment-only header-verification hold.
- The HUMANAUDIT-derived queue `S-157..S-162` is accepted except for the login-language outcome: the shipped login still opens in the previously selected language, still lacks the in-app language selector, and still uses workflow-jargon copy that is not acceptable for a first-time user.
- The current locally executable target is the focused login-language remediation row `S-163`.
- Customer source material still anchors the product on three real result statements, explicit year review, 20-year investment planning, and depreciation derived from the freshest booked year plus future investments.
- The current V2 workflow remains Overview -> Forecast -> Reports; the new queue must preserve explicit approval, provenance, freshness, depreciation visibility, and report-readiness truth while reducing trust-breaking UI friction.

## Top blockers

1. `S-156` cannot be closed from this workspace until the live frontend edge emits the repo-defined header policy and that state can be re-verified.
2. The current top blocker in local scope is entry-language trust: login still does not default to Finnish, does not expose the in-app language selector on the login screen, and still uses workflow-jargon copy in FI/SV/EN.

## Next actions

1. Execute `S-163` to force Finnish on unauthenticated entry, add the in-app language selector to login, and replace the remaining workflow-jargon login copy with plain FI-first wording plus aligned SV/EN translations.
2. Re-run the login flow in all three languages after `S-163`, including first-open, manual language switch, and persisted-language behavior after sign-in.
3. Re-verify the deployed frontend edge headers when the required deployment access is available, then close `S-156` if the live state matches the repo contract.

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
