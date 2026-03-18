# Project status

Last updated: 2026-03-18

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The `Yhteenveto` perfection queue through `S-92` is accepted and closed.
- The step-2 modernization and QDIS queue through `S-97` is accepted; only the final `S-98` live audit was blocked by a missing real 2022 QDIS PDF input.
- Live Kronoby verification showed that years `2022`, `2023`, and `2024` all miss `Material och tjanster` from VEETI even though they otherwise look importable.
- The KVA workbook provides truthful multi-year financial-row repairs for those years, while the 2024 statement PDF acts as a stronger full-year finance source rather than a one-line fix.
- The active sprint `S-99..S-106` has accepted workbook selective override, the explicit 2024 mixed-source merge, and the new `Investointiohjelma` start surface; the remaining work is PTS-driven depreciation defaults, impact wiring, and the closing audit.

## Top blockers

1. There is no user-confirmed multi-year workbook compare/apply flow for historical year repair; users still have to fix VEETI gaps year by year.
2. The product does not yet model the 2024 merge truthfully: VEETI baseline, KVA line repair, and statement-PDF override compete without one explicit user-confirmed merge path.
3. `Poistosaannot` defaults from the PTS workbook are not yet connected to the new `Investointiohjelma` entry surface or the current depreciation engine.
4. Current customer docs provide a clear source for the six shared financial rows, but not one equally clear cross-year sold-volume import source.

## Next actions

1. Build `kva_import` selective override with per-year compare and confirmation for the six shared financial rows.
2. Implement the 2024 merge path so statement PDF remains the stronger finance source while workbook values can repair unresolved lines such as `Material och tjanster`.
3. Prefill `Poistosaannot` from the PTS workbook, map them to the current depreciation engine, and keep operator language primary.
4. Close with a Kronoby live audit covering wipe, VEETI reconnect/import, workbook repair, 2024 statement merge, and entry into investment planning.

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
