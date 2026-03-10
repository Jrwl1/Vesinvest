# Project status

Last updated: 2026-03-09

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Previous trust hardening `S-11..S-20`, trusted-baseline `S-21..S-25`, and V2 UI refresh `S-26..S-30` are completed and accepted.
- New post-audit hardening queue `S-31..S-36` is active; `S-31`, `S-32`, `S-33`, `S-34`, and `S-35` are completed and accepted.
- OS contract now states explicitly that ignored local scratch files do not block protocol runs; tracked or untracked non-ignored changes still do.
- OS contract now also allows DO to edit sprint-listed non-canonical product docs/config examples, which unblocks `S-32` doc/env truth alignment.
- `S-31` hardened destructive account-clear safety in both UI and backend enforcement.
- `S-33` hardened Forecast state authority across badges, CTA copy, KPI/chart surface cues, and report-readiness messaging.
- `S-34` is accepted: save-only Forecast updates preserve compute-backed KPI/chart surfaces, AppShell-backed runtime state restores selected scenario plus valid compute tokens across remounts, report-focused back/forward navigation restores the matching Forecast context, and targeted trust regressions now cover the flow.
- `S-35` is accepted: component-layer fallback copy routes through locale keys, exercised FI/SV/EN trust/admin surfaces are covered and cleaned, and locale-backed regression checks now guard the translated Overview, Forecast, Reports, and login flow.
- `S-36` is in progress: desktop language buttons now use matching visible and accessible labels, Forecast investment editor controls expose explicit per-year accessible names, and the next step is keyboard-focus verification across the refreshed shell.

## Top blockers

1. Customer-owned `B-TBD-01..B-TBD-05` remain unresolved but non-blocking.
2. No active protocol blocker is open; `S-36` can continue immediately from the keyboard-focus verification substep.
3. Optional product clarification remains open but non-blocking: whether local dev should default demo mode on, or stay opt-in with docs matching shipped runtime truth.

## Next actions

1. Keep the tracked working tree clean, then continue `DO` or `RUNSPRINT` from `S-36` substep 3.
2. Recheck keyboard focus and desktop interactive affordances without regressing the accepted language-button and investment-field accessibility work.
3. Preserve the shipped statement-import, trusted-baseline, translated V2 flow, and accepted Forecast authority model while hardening accessibility.
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
