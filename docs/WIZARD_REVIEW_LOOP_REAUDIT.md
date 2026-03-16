# Wizard Review Loop Re-audit

Date: 2026-03-16

Scope:
- Fresh local browser audit from `Tili -> Tyhjennä tietokanta`
- Walk the wizard through steps `1..6`
- Confirm no-change approval, review-first mode, locale parity, missing-state previews, and review-queue auto-advance in a live session

Runtime fix used for this audit:
- The local Vite dev proxy target was corrected from `localhost:3000` to `127.0.0.1:3000` in [vite.config.ts](C:\Users\john\Plan20\saas-monorepo\apps\web\vite.config.ts).
- The missing local Prisma migration `20260315204000_add_scenario_depreciation_storage` was applied to the local database with `pnpm --filter ./apps/api prisma:migrate:deploy`.

Live audit result:
- `Tili -> Tyhjennä tietokanta` returned the workspace to step `1 / 6`.
- Step 1 reconnect worked for `Kronoby vatten och avlopp ab`.
- Step 2 imported the selected ready years into the workspace.
- Step 3 / 4 review stayed calm and truthful: `Avaa ja tarkista` opened comparison-first review mode, and `Pidä mukana` approved years without forcing edits.
- The review queue auto-advanced across `2024 -> 2023 -> 2022`.
- Step 5 built the planning baseline from the approved years.
- Step 6 unlocked both `Ennuste` and `Raportit`.
- Forecast opened without the earlier `500` banner once the local migration was applied.
- Reports opened with the expected empty-state guidance after the handoff.

Outcome:
- whole sprint succeeded
