# Project status

Last updated: 2026-03-17

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The comprehensive frontend-overhaul queue through `S-86` is accepted, and `S-87` is now accepted too: the shared `Yhteenveto` summary contract uses direct canon rows, includes `Poistot`, removes the invented `AineetJaPalvelut` fallback split, and explicitly records that the current VEETI/API path is summary-only for truthful subrows.
- The latest customer clarification still locks the remaining UI work harder than the earlier overhaul queue did: the cards must show the 6-row canon visibly, use literal zero/missing wording, support whole-card inline editing, keep secondary price/volume stats on-card, and avoid a separate normal-correction modal flow.
- The active queue is now `S-88..S-92`: 6-row card layout, inline whole-card edit mode, step-3 parity, language/zero-missing polish, and a final live audit with the real 2024 PDF path.

## Top blockers

1. `Yhteenveto` cards still are not the direct editing surface the customer wants.
2. The visible step-2/step-3 card layout still needs the full 6-row canon stack, stronger `Tulos` treatment, and on-card secondary stats.
3. Literal missing/zero wording and language/default-language behavior still need one dedicated sprint to be considered locked.

## Next actions

1. Execute `S-88` to rebuild step-2 cards around the locked 6-row canon and literal warning language.
2. Execute `S-89..S-91` to bring inline whole-card editing, step-3 parity, and language/zero-missing polish onto the same card model.
3. Close with `S-92` by running the full `Yhteenveto` audit, including the real 2024 statement-PDF correction path.

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
