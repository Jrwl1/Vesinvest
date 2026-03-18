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
- The active sprint `S-99..S-106` has accepted workbook selective override, the explicit 2024 mixed-source merge, the `Investointiohjelma` start surface, and the PTS-derived `Poistosaannot` defaults; the remaining work is impact wiring and the closing audit.

## Top blockers

1. Saved `Investointiohjelma` inputs are not yet wired into the simpler yearly-investment, depreciation, tariff-pressure, and cash-impact views at the top of Forecast.
2. The sprint still lacks the closing Kronoby live audit that proves workbook repair, 2024 mixed-source merge, and entry into investment planning end to end.
3. Current customer docs provide a clear source for the six shared financial rows, but not one equally clear cross-year sold-volume import source.

## Next actions

1. Wire saved `Investointiohjelma` entries into yearly investments, depreciation preview, tariff pressure, and cash impact.
2. Add the final focused regressions for workbook compare/apply, 2024 mixed-source merge, and `Investointiohjelma`.
3. Close with a Kronoby live audit covering wipe, VEETI reconnect/import, workbook repair, 2024 statement merge, and entry into investment planning.

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
