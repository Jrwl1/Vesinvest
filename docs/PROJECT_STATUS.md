# Project status

Last updated: 2026-03-23

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The security/performance remediation queue `S-149..S-156` is now accepted; the 2026-03-22 rerun confirmed the full release gate passes and the live frontend edge emits the repo-defined header policy.
- The HUMANAUDIT-derived frontend trust/interaction queue `S-157..S-163` is active again because the earlier archive acceptance no longer matches current code truth.
- `S-164..S-167` remain accepted history, but `S-157..S-163` are no longer treated as done.
- A docs-only OS hardening pass rewrote `AGENTS.md` around shared enforcement plus consistent per-mode sections, while keeping the current protocol behavior and the new no-invented-copy rule explicit.
- A follow-up OS correction removed default `docs/client/**` reads from PLAN; client PDFs, Excels, and other customer-source docs now require explicit user naming in the current PLAN pass.
- `docs/SPRINT.md` and `docs/BACKLOG.md` are now trimmed for active/open use, while `docs/SPRINT_ARCHIVE.md` and `docs/BACKLOG_ARCHIVE.md` hold condensed accepted history outside default protocol reads.
- Backlog is now treated as a user-owned optional parking lot rather than a default protocol input; sprint remains the execution source of truth.
- Customer source material still anchors the product on three real result statements, explicit year review, 20-year investment planning, and depreciation derived from the freshest booked year plus future investments.
- The current V2 workflow remains Overview -> Forecast -> Reports; the latest local rerun proved the calmer login first paint, the live 2022 `194 000` expense edit, the visible `Tulos` drop to `10 628`, and the compact price/volume tile fit on the running app.

## Top blockers

1. The active OS surface had stale packet-era wording and wrongly re-accepted reopened rows in `docs/SPRINT.md`; that contradiction is being corrected now.
2. `S-157..S-163` remain executable open scope until their acceptance is re-proven against current code.

## Next actions

1. Re-run the active frontend rows `S-157..S-163` under the corrected row-driven OS contract.
2. Use `HUMANAUDIT` only for brand-new findings outside that reopened queue.

## Customer TBD tracking

No customer-owned TBD items are currently parked in the main backlog.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/DECISIONS.md`
