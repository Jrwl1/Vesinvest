# Project status

Last updated: 2026-03-22

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The security/performance remediation queue `S-149..S-155` is accepted, and `S-156` remains `READY` as a deployment-only header-verification hold.
- The HUMANAUDIT-derived frontend trust/interaction queue `S-157..S-167` is now accepted, including the calmer login entry, visible year-card result sync after finance edits, removed result-commentary block, and cleaner compact secondary tiles.
- A docs-only OS hardening pass rewrote `AGENTS.md` around shared enforcement plus consistent per-mode sections, while keeping the current protocol behavior and the new no-invented-copy rule explicit.
- A follow-up OS correction removed default `docs/client/**` reads from PLAN; client PDFs, Excels, and other customer-source docs now require explicit user naming in the current PLAN pass.
- `docs/SPRINT.md` and `docs/BACKLOG.md` are now trimmed for active/open use, while `docs/SPRINT_ARCHIVE.md` and `docs/BACKLOG_ARCHIVE.md` hold condensed accepted history outside default protocol reads.
- Customer source material still anchors the product on three real result statements, explicit year review, 20-year investment planning, and depreciation derived from the freshest booked year plus future investments.
- The current V2 workflow remains Overview -> Forecast -> Reports; the latest local rerun proved the calmer login first paint, the live 2022 `194 000` expense edit, the visible `Tulos` drop to `10 628`, and the compact price/volume tile fit on the running app.

## Top blockers

1. `S-156` cannot be closed from this workspace until the live frontend edge emits the repo-defined header policy and that state can be re-verified.
2. No further local blocker remains in the current frontend queue; the only remaining unfinished row is the deployment-side `S-156` hold.

## Next actions

1. Re-verify the deployed frontend edge headers when the required deployment access is available, then close `S-156` if the live state matches the repo contract.
2. Keep using `HUMANAUDIT` for any new screenshot/video findings and reopen the queue through `PLAN` only when a real new frontend scope gap is confirmed.

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
