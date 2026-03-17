# Project status

Last updated: 2026-03-17

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The comprehensive frontend-overhaul queue through `S-86` is accepted, and `S-87` is now accepted too: the shared `Yhteenveto` summary contract uses direct canon rows, includes `Poistot`, removes the invented `AineetJaPalvelut` fallback split, and explicitly records that the current VEETI/API path is summary-only for truthful subrows.
- `S-88` is now accepted too: step-2 cards visibly show the 6-row canon, `Tulos` is strongest at the bottom, literal source/problem wording replaced the vague trust copy, and the secondary price/volume stats now sit inline below the accounting stack.
- `S-89` is now accepted too: step-2 cards themselves now open into inline whole-card edit mode, visible numbers focus the matching field, and saves stay local on the active card instead of bouncing the user into a modal flow.
- The active queue is now `S-90..S-92`: step-3 parity, language/zero-missing polish, and a final live audit with the real 2024 PDF path.

## Top blockers

1. Step 3 still needs the same card model and on-card actions as step 2, without falling back to a separate correction modal flow.
2. Literal missing/zero wording is now in step 2, but the full zero/missing visual system and language/default-language behavior still need dedicated finishing work.
3. The sprint still needs a final live audit that proves the real 2024 statement-PDF path and the subrow answer hold end to end.

## Next actions

1. Execute `S-90` to bring the same on-card model and actions into step 3 review.
2. Execute `S-91` to finish the language/default-language and zero/missing polish on the same card surface.
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
