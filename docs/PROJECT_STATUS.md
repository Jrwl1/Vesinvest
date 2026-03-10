# Project status

Last updated: 2026-03-09

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Previous trust hardening `S-11..S-20`, trusted-baseline `S-21..S-25`, and V2 UI refresh `S-26..S-30` are completed and accepted.
- New post-audit hardening queue `S-31..S-36` is active; `S-31`, `S-32`, and `S-33` are completed and accepted.
- OS contract now states explicitly that ignored local scratch files do not block protocol runs; tracked or untracked non-ignored changes still do.
- OS contract now also allows DO to edit sprint-listed non-canonical product docs/config examples, which unblocks `S-32` doc/env truth alignment.
- `S-31` hardened destructive account-clear safety in both UI and backend enforcement.
- `S-33` hardened Forecast state authority across badges, CTA copy, KPI/chart surface cues, and report-readiness messaging.
- `S-34` is in progress: save-only Forecast updates preserve compute-backed KPI/chart surfaces, AppShell-backed runtime state restores selected scenario plus valid compute tokens across remounts, and report-focused back/forward navigation now restores the matching Forecast context.
- `S-35` targets mixed-language cleanup across login, Overview, Forecast, and Reports.
- `S-36` targets desktop accessibility fixes and final quality gates.

## Top blockers

1. Customer-owned `B-TBD-01..B-TBD-05` remain unresolved but non-blocking.
2. No active protocol blocker is open; `S-34` can continue immediately from the regression-coverage substep.
3. Optional product clarification remains open but non-blocking: whether local dev should default demo mode on, or stay opt-in with docs matching shipped runtime truth.

## Next actions

1. Keep the tracked working tree clean, then continue `DO` or `RUNSPRINT` from `S-34` substep 4.
2. Preserve the new Forecast state-authority model while adding regression coverage for save-vs-compute authority and Forecast/Reports navigation restoration.
3. Preserve the shipped statement-import, trusted-baseline, and refreshed V2 Overview/Forecast/Reports flow as the baseline while hardening trust gaps.
4. Keep root quality gates green in subsequent work.
5. Revisit the optional dev-demo default decision only after the current runtime truth hardening ships.

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
