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
- `S-92` is now accepted too: the final regression suite is locked, the live audit reran from a wiped workspace, the real 2024 statement PDF corrected year `2024` on-card and synced successfully, the step-3 depreciation parity gap found during the live pass was fixed, and the final audit artifact ends with `whole sprint succeeded`.
- There are no active sprint rows left in `docs/SPRINT.md`.

## Top blockers

1. No active `Yhteenveto` sprint blockers remain; the queue `S-87..S-92` is complete.
2. Remaining open work is outside this sprint and stays in backlog/TBD tracking.
3. Customer-owned acceptance TBDs still remain as `B-TBD-01..B-TBD-05`.

## Next actions

1. Select the next milestone or planning pass outside the completed `Yhteenveto` sprint.
2. Use [YHTEENVETO_FINAL_AUDIT.md](/C:/Users/john/Plan20/saas-monorepo/docs/YHTEENVETO_FINAL_AUDIT.md) as the closing artifact for this queue.
3. Keep customer-owned acceptance TBDs visible until the next planning rotation resolves them.

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
