# Project status

Last updated: 2026-03-11

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36` is fully completed and accepted.
- New active queue `S-37..S-42` replans the first authenticated window from a mixed Overview/dashboard surface into a six-step setup wizard.
- `S-37` is accepted: the shell now derives wizard-step lock state from Overview/import/context signals, the Overview opens with wizard question chrome plus sticky setup summary, the org chip shows company plus short hash, Forecast/Reports stay locked, and the old import panels no longer expose competing primary CTAs.
- `S-38` is accepted: V2 now separates year import from baseline-budget generation at the contract level, the visible step-1/step-2 flow uses `Yhdistä organisaatio` and `Tuo valitut vuodet`, and imported years are explicitly confirmed in the workspace copy.
- `S-39` is accepted: step 3 now renders a focused year-status list with only `Tilinpäätös`, `Taksa`, and `Volyymit`, plus one overall status and a single `Jatka` CTA, the old peer snapshot/admin ops/duplicate status clutter is gone from the first window, and helper coverage now locks the wizard-state plus excluded-year behavior.
- `S-40` is accepted: the API now has a separate non-destructive exclusion contract, the year modal is refocused into keep/fix/exclude/restore decisions, setup-surface delete wording points to `Pois suunnitelmasta`, and regression coverage locks exclusion, restore, and manual-fix behavior.
- Code reality today still couples year import and baseline-budget generation inside `syncImport`, so step 2 and step 5 are not yet truthfully separated.
- The next active scope is now `S-41`: separating planning-baseline creation from the remaining `syncImport`/budget-generation language and behavior.
- The current first window still carries older import panels and the next active scope is now the truthful non-destructive step-4 exclusion/repair contract.
- Forecast creation still depends on a trusted VEETI baseline budget before `createForecastScenario` can succeed.
- PLAN contract now allows docs-only planning on top of pre-existing dirt, but the current tree is clean.

## Top blockers

1. Customer-owned `B-TBD-01..B-TBD-05` remain unresolved but non-blocking.
2. Wizard step 2 (`Tuo valitut vuodet`) and step 5 (`Luo suunnittelupohja`) require explicit contract separation from the current `syncImport` flow.
3. Setup wording `Pois suunnitelmasta` cannot ship until exclusion is separated from destructive year deletion or clearly routed to a different action.
4. No active protocol blocker is open yet, but `S-41` is the next contract-heavy step because planning-baseline creation still rides on the older `syncImport` flow and copy.

## Next actions

1. Continue `RUNSPRINT` with `S-41` substep 1: add an explicit planning-baseline API contract after setup review is complete.
2. Preserve shipped statement-import, trusted-baseline, Forecast authority, translation, and desktop accessibility behavior while moving them behind the wizard flow.
3. Split import-years and planning-baseline creation before shipping the new step 2 and step 5 copy.
4. Move peer/admin/debug surfaces out of the first-window setup path or behind secondary details.
5. Refresh supporting non-canonical docs after wizard acceptance so they no longer describe the old Overview -> sync entry flow.

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
