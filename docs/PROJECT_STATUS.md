# Project status

Last updated: 2026-03-17

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The comprehensive frontend-overhaul queue through `S-86` is accepted; the next gap is now narrower and very explicit: `Yhteenveto` year cards still need a dedicated perfection sprint.
- The latest customer clarification locked the year-card model harder than the earlier overhaul queue did: 5 canon line items plus `Tulos`, direct `AineetJaPalvelut` when VEETI has it, literal zero/missing wording, whole-card inline editing, secondary price/volume stats, and no normal-correction modal flow.
- Current code still contains the fallback split for `AineetJaPalvelut`, and current cards still need a dedicated on-card editing surface rather than the deeper shared review UI as the normal correction path.
- The active queue is therefore `S-87..S-92`: truthful card data contract, 6-row card layout, inline whole-card edit mode, step-3 parity, language/zero-missing polish, and a final live audit with the real 2024 PDF path.

## Top blockers

1. `Yhteenveto` cards still are not the direct editing surface the customer wants.
2. The current card data model still needs the fallback split removed and the canon line-item stack tightened.
3. Literal missing/zero wording and language/default-language behavior still need one dedicated sprint to be considered locked.

## Next actions

1. Execute `S-87` to lock the truthful `Yhteenveto` data contract, remove the fallback split, and answer subrow availability.
2. Execute `S-88..S-91` to rebuild step-2/step-3 cards into the locked 6-row inline-edit model.
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
