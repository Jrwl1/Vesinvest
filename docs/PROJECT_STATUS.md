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
- `S-41` is accepted: the API now has a separate planning-baseline contract, Overview shows a step-5 planning-baseline summary plus `Luo suunnittelupohja`, the sticky summary updates after success, and regression coverage locks baseline creation/skipped years/post-baseline readiness.
- `S-42` is accepted: wizard completion now requires a real planning baseline plus resolved prior steps, Overview exposes the final step-6 starter form plus `Avaa Ennuste`, AppShell carries starter scenarios directly into Forecast, and the unlock/handoff regressions are locked.
- The active queue `S-37..S-42` is fully completed and accepted.
- Forecast creation still depends on a trusted VEETI baseline budget before `createForecastScenario` can succeed.
- PLAN contract now allows docs-only planning on top of pre-existing dirt, but the current tree is clean.

## Top blockers

1. Customer-owned `B-TBD-01..B-TBD-05` remain unresolved but non-blocking.
2. Wizard step 2 (`Tuo valitut vuodet`) and step 5 (`Luo suunnittelupohja`) require explicit contract separation from the current `syncImport` flow.
3. Setup wording `Pois suunnitelmasta` cannot ship until exclusion is separated from destructive year deletion or clearly routed to a different action.
4. No active protocol blocker is open in the current sprint queue.

## Next actions

1. Rotate the completed wizard queue out of `docs/SPRINT.md` with a new `PLAN` pass.
2. Refresh supporting non-canonical docs so they no longer describe the old Overview -> sync entry flow.
3. Preserve shipped statement-import, trusted-baseline, Forecast authority, translation, and desktop accessibility behavior in follow-up scope.

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
