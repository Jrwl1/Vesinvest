# Project status

Last updated: 2026-03-11

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36` is fully completed and accepted.
- New active queue `S-37..S-42` replans the first authenticated window from a mixed Overview/dashboard surface into a six-step setup wizard.
- `S-37` substep 1 is committed and reviewed: the shell now derives wizard-step lock state from Overview/import/context signals and blocks Forecast/Reports when setup is incomplete.
- `S-37` substep 2 is committed and reviewed: the Overview landing stack now opens with wizard question chrome and a sticky compact setup summary instead of the old hero/next-step/legacy status pile.
- `S-37` substep 3 is committed and reviewed: the shell org chip now shows company plus short hash, and locked Forecast/Reports behavior is under targeted AppShell regression coverage.
- `S-37` review exposed one remaining shell-gap: the old import panels still expose multiple primary CTAs, so the sprint has been reopened with an explicit CTA-cleanup substep.
- Code reality today still couples year import and baseline-budget generation inside `syncImport`, so step 2 and step 5 are not yet truthfully separated.
- Code reality today still uses destructive year removal behind the setup exclusion flow, so `Pois suunnitelmasta` is not yet truthful without backend changes.
- The current first window still mixes the new wizard chrome with older import panels, trend cards/chart, peer snapshot, admin ops snapshot, and detailed comparison workspace, and S-37 still needs its final regression sweep before READY.
- Forecast creation still depends on a trusted VEETI baseline budget before `createForecastScenario` can succeed.
- PLAN contract now allows docs-only planning on top of pre-existing dirt, but the current tree is clean.

## Top blockers

1. Customer-owned `B-TBD-01..B-TBD-05` remain unresolved but non-blocking.
2. Wizard step 2 (`Tuo valitut vuodet`) and step 5 (`Luo suunnittelupohja`) require explicit contract separation from the current `syncImport` flow.
3. Setup wording `Pois suunnitelmasta` cannot ship until exclusion is separated from destructive year deletion or clearly routed to a different action.
4. `S-37` still needs explicit CTA cleanup across the import panels before the shell row can satisfy the single-primary-action acceptance.

## Next actions

1. Continue `RUNSPRINT` with the new `S-37` CTA-cleanup substep so the first window has only one loud primary action at a time.
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
