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
- `S-90` is now accepted too: step 3 now reuses the same inline year-card surface as step 2, keeps save/sync/restore/PDF/exclude actions on the card, and limits auto-advance to the explicit review queue instead of the step-2 import-selection path.
- `S-91` is now accepted too: card actions now stay in the chosen UI language, real zeroes have their own visible card state, VEETI-missing values now say VEETI did not provide them, and the live VEETI org payload answer is confirmed as `Kieli_Id`-based org language with manual override preserved.
- The active queue is now `S-92` only: final focused regressions and the live audit with the real 2024 PDF path.

## Top blockers

1. The sprint still needs the final focused regression pass that locks the full 6-row card, inline editing, literal warning copy, and card-owned actions together one more time.
2. The sprint still needs a wiped-workspace live audit that proves the real 2024 statement-PDF correction path and the subrow answer hold end to end.
3. The sprint is not complete until the final audit artifact explicitly ends with `whole sprint succeeded` or a blocker.

## Next actions

1. Execute `S-92` packet 1 to rerun the final focused regressions across web/api card surfaces.
2. Run the `S-92` live browser audit from a wiped workspace, including the real 2024 statement PDF correction flow.
3. Write `docs/YHTEENVETO_FINAL_AUDIT.md` with the verified subrow answer and the explicit sprint outcome.

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
