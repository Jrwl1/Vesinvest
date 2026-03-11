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
- `S-38` substep 1 is committed and reviewed: V2 now exposes an explicit import-years contract that refreshes VEETI data and reports imported/skipped years without generating baseline budgets.
- `S-38` substep 2 is committed and reviewed: the visible step-1/step-2 UI now separates organization connection from the `Tuo valitut vuodet` action.
- `S-38` substep 3 is committed and reviewed: imported years are now explicitly confirmed in the wizard summary/body instead of being implied through sync-oriented language.
- Code reality today still couples year import and baseline-budget generation inside `syncImport`, so step 2 and step 5 are not yet truthfully separated.
- Code reality today still uses destructive year removal behind the setup exclusion flow, so `Pois suunnitelmasta` is not yet truthful without backend changes.
- The current first window still mixes the accepted wizard shell with older import panels, trend cards/chart, peer snapshot, admin ops snapshot, and detailed comparison workspace.
- Forecast creation still depends on a trusted VEETI baseline budget before `createForecastScenario` can succeed.
- PLAN contract now allows docs-only planning on top of pre-existing dirt, but the current tree is clean.

## Top blockers

1. Customer-owned `B-TBD-01..B-TBD-05` remain unresolved but non-blocking.
2. Wizard step 2 (`Tuo valitut vuodet`) and step 5 (`Luo suunnittelupohja`) require explicit contract separation from the current `syncImport` flow.
3. Setup wording `Pois suunnitelmasta` cannot ship until exclusion is separated from destructive year deletion or clearly routed to a different action.
4. No active protocol blocker is open yet, but `S-38` is the next likely contract-heavy step because import-years and baseline creation are still coupled in `syncImport`.

## Next actions

1. Continue `RUNSPRINT` with `S-38` substep 4: finish the final regression sweep for separated connect/import behavior across the API and Overview UI.
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
