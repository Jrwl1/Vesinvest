# Project status

Last updated: 2026-03-17

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The comprehensive frontend-overhaul queue through `S-86` is accepted, and `S-87` is now accepted too: the shared `Yhteenveto` summary contract uses direct canon rows, includes `Poistot`, removes the invented `AineetJaPalvelut` fallback split, and explicitly records that the current VEETI/API path is summary-only for truthful subrows.
- `S-88` is now accepted too: step-2 cards visibly show the 6-row canon, `Tulos` is strongest at the bottom, literal source/problem wording replaced the vague trust copy, and the secondary price/volume stats now sit inline below the accounting stack.
- The active queue is now `S-89..S-92`: inline whole-card edit mode, step-3 parity, language/zero-missing polish, and a final live audit with the real 2024 PDF path.

## Top blockers

1. `Yhteenveto` cards still are not the direct editing surface the customer wants.
2. Step 3 still needs the same card model and on-card actions as step 2, without falling back to a separate correction modal flow.
3. Literal missing/zero wording is now in step 2, but the full zero/missing visual system and language/default-language behavior still need dedicated finishing work.

## Next actions

1. Execute `S-89` to make the step-2 card itself the inline whole-card editing surface.
2. Execute `S-90..S-91` to bring the same on-card model into step 3 and finish the language/zero-missing polish.
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
