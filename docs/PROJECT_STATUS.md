# Project status

Last updated: 2026-03-23

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The security/performance remediation queue `S-149..S-156` remains accepted history except for the deployment-only `S-156` header-verification hold.
- `S-157..S-167` remain done. This planning pass removes the stale reopened-queue drift and returns `docs/SPRINT.md` to one truthful active row.
- Fresh HUMANAUDIT evidence found one narrower login-entry gap still visible in current code: the login hero still makes small blue `Vesipolku` visually secondary to the larger `auth.workspaceTitle`, and the redundant `auth.workspaceBody` sentence still sits above the three point boxes.
- The same stale hero contract still exists in the unauthenticated loading/error path in `apps/web/src/App.tsx`, so a pure `LoginForm.tsx` patch would not fully remove the bad first impression.
- `S-168` is now the only active execution row and isolates that login-entry hierarchy cleanup without reopening the broader wizard and year-card queues.

## Top blockers

1. `S-168` is not executed yet, so the login still shows the wrong hierarchy and redundant intro copy on first unauthenticated open.
2. The loading/error entry surface in `apps/web/src/App.tsx` still uses the removed hero-copy contract until `S-168` lands.

## Next actions

1. Run `DO` for `S-168`.
2. Run row-gated `REVIEW` once `S-168` reaches `READY`.

## Customer TBD tracking

No customer-owned TBD items are currently parked in the main backlog.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/DECISIONS.md`
