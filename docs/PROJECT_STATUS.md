# Project status

Last updated: 2026-03-23

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The security/performance remediation queue `S-149..S-156` remains accepted history except for the deployment-only `S-156` header-verification hold.
- `S-157..S-168` now remain done. The latest rerun closed the login-entry hierarchy gap with one large blue `Vesipolku` heading, no redundant intro sentence, and aligned unauthenticated loading/error hero markup.
- The required web gate passed after a same-package test-runner hardening in `apps/web/vitest.config.ts` forced a single forked worker without file parallelism.
- No active local execution row remains in `docs/SPRINT.md`.

## Top blockers

1. No executable local blocker remains in the current sprint queue after `S-168` acceptance.
2. `S-156` remains a deployment-only header-verification hold outside this workspace.

## Next actions

1. Use `HUMANAUDIT` for any new screenshot-led findings.
2. In the next planning pass, trim accepted `S-168` out of `docs/SPRINT.md` or replace it with the next active row.

## Customer TBD tracking

No customer-owned TBD items are currently parked in the main backlog.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/DECISIONS.md`
