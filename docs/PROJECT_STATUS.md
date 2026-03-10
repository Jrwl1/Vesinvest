# Project status

Last updated: 2026-03-09

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Previous trust hardening `S-11..S-20`, trusted-baseline `S-21..S-25`, and V2 UI refresh `S-26..S-30` are completed and accepted.
- New post-audit hardening queue `S-31..S-36` is fully completed and accepted.
- OS contract now states explicitly that ignored local scratch files do not block protocol runs; tracked or untracked non-ignored changes still do.
- OS contract now also allows DO to edit sprint-listed non-canonical product docs/config examples, which unblocks `S-32` doc/env truth alignment.
- `S-31` hardened destructive account-clear safety in both UI and backend enforcement.
- `S-33` hardened Forecast state authority across badges, CTA copy, KPI/chart surface cues, and report-readiness messaging.
- `S-34` is accepted: save-only Forecast updates preserve compute-backed KPI/chart surfaces, AppShell-backed runtime state restores selected scenario plus valid compute tokens across remounts, report-focused back/forward navigation restores the matching Forecast context, and targeted trust regressions now cover the flow.
- `S-35` is accepted: component-layer fallback copy routes through locale keys, exercised FI/SV/EN trust/admin surfaces are covered and cleaned, and locale-backed regression checks now guard the translated Overview, Forecast, Reports, and login flow.
- `S-36` is accepted: desktop language buttons now use matching visible and accessible labels, Forecast investment editor controls expose explicit per-year accessible names, refreshed V2 focus states are clearer for keyboard-only use, and the final web/root quality gates pass.

## Top blockers

1. Customer-owned `B-TBD-01..B-TBD-05` remain unresolved but non-blocking.
2. No active protocol blocker is open; the active sprint queue is complete.
3. Optional product clarification remains open but non-blocking: whether local dev should default demo mode on, or stay opt-in with docs matching shipped runtime truth.

## Next actions

1. Keep the tracked working tree clean and start a new `PLAN` pass for the next milestone or release-hardening queue.
2. Preserve the shipped statement-import, trusted-baseline, translated V2 flow, accepted Forecast authority model, and desktop accessibility fixes as the new baseline.
3. Keep root quality gates green in subsequent work.
4. Revisit the optional dev-demo default decision only after the next planning pass prioritizes it.
5. Resolve customer-owned `B-TBD-01..B-TBD-05` when they become relevant to release acceptance.

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
