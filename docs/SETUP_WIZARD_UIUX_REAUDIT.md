# Setup Wizard UI/UX Re-audit

Date: 2026-03-20
Mode: local browser live audit
Environment:
- Web: `http://127.0.0.1:4174` (fresh Vite server from the current working tree)
- API: `http://127.0.0.1:3000`
- API mode: `trial`

Authenticated entries used:
- Existing workspace: `admin@vesipolku.dev`
- Fresh isolated trial org: `timing.audit.c@dev.local`

Target flow:
1. Login
2. Legal accept if required
3. Search
4. Connect
5. Explicit import
6. Review continue
7. Step 6 handoff
8. Forecast and Reports open

Observed result:
- The fresh isolated org (`timing.audit.c@dev.local`) starts truthfully from login -> legal accept -> step 1 search -> step 2 connect/import on the new literal-copy surfaces.
- Direct ID search `1535` returned `Kronoby vatten och avlopp ab`, connect advanced to step 2, and the import board still showed the parked-year and warning-first lane treatment before import.
- Importing the default selected years moved the fresh org to step 3 with explicit review-required states, which matched the current warning-first review model instead of silently auto-approving the years.
- The existing `admin@vesipolku.dev` workspace opened directly into step 3 with the corrected Kronoby years visible as `Redo för granskning`.
- On that existing workspace, `Fortsätt` opened the explicit year-decision flow instead of a false unlocked handoff. Approving the three ready years with `Behåll i planen` advanced the flow to step 6.
- After the approvals, step 6 showed `Planeringsunderlaget är klart`, `Öppna Prognos` navigated to `/forecast`, and the shell `Rapporter` tab navigated onward to `/reports`.

Notes:
- The focused regression bundle added in `S-136` now locks the exact VEETI-id lookup path, the explicit approval path after `Jatka`, and the final handoff expectations in tests.
- The previously running `5173` dev server continued to serve stale handoff behavior during debugging, so the successful audit was rerun on a fresh `4174` Vite instance launched from the updated working tree.

Conclusion:
whole sprint succeeded

---

Residual queue rerun

Date: 2026-03-21
Mode: local browser live audit
Environment:
- Web: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:4174`
- Workspace: `admin@vesipolku.dev`

Observed result:
- The login screen now keeps the sign-in task visually first; the API and demo-status metadata sits below the credential form as supporting context.
- Logging into the existing linked workspace opened step 3 directly with imported years `2024`, `2023`, and `2022` visible on the review surface.
- A fresh linked-workspace reload fetched only `/v2/import/years/2024/data`, `/2023/data`, and `/2022/data`; no `/2025/data` or `/2026/data` requests appeared.
- Opening year `2024`, choosing `Full manuell korrigering`, changing `Material och tjanster` from `69 167` to `69 168`, and saving updated the current step-3 card in place, kept the user on step 3, and advanced the reviewed count from `0` to `1`.

Residual conclusion:
whole residual queue succeeded

---

Refactor queue rerun

Date: 2026-03-21
Mode: local browser live audit
Environment:
- Web: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:3000` (via the web app's `/api` path)
- Workspace: `admin@vesipolku.dev`

Observed result:
- Logging into `admin@vesipolku.dev` landed directly on step 3 in the linked Kronoby workspace with imported years `2024`, `2023`, and `2022` visible on the extracted review surface.
- Opening `2024` still kept all review actions on the card itself. A no-change `Spara och synkronisera år` attempt was correctly blocked with `Inga ändringar upptäcktes`, so the flow still requires a real edit before saving.
- A reversible manual audit save still worked: changing `Material och tjänster` from `69 168` to `69 169`, using `Spara årsdata`, reopening the same year, restoring `69 168`, and then using `Spara och synkronisera år` returned the card to its original value while keeping the user on step 3.
- After the reversible save, the reviewed count advanced from `0` to `1`, and the remaining ready years `2023` and `2022` could still be approved in-place with `Behåll i planen` without leaving the review surface.
- Approving the remaining years advanced the flow to step 6 with `Planeringsunderlaget är klart`, `Öppna Prognos` navigated to `/forecast`, and the unlocked `Rapporter` tab navigated onward to `/reports`.

Refactor conclusion:
whole refactor queue succeeded

---

Connected wizard re-audit rerun

Date: 2026-03-22
Mode: local browser live audit
Environment:
- Web: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:3000`
- Database: `plan20-postgres` on `localhost:5432`
- Fresh audit workspace: `timing.audit.b@dev.local`

Automated regression status:
- `pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts` -> PASS
- `pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts` -> PASS
- `pnpm --filter ./apps/web typecheck` -> PASS
- `pnpm --filter ./apps/api typecheck` -> PASS

Observed result:
- Docker-backed Postgres returned on `localhost:5432`, the API health returned `{"status":"ok"}`, and the restart blocker cleared.
- Logging into `timing.audit.b@dev.local` with `admin123` opened a clean wizard state after an org-scoped reset from the account drawer.
- Direct ID search `1535` returned `Kronoby vatten och avlopp ab`, `Anslut valt verk` advanced to step 2, and the import board still showed the warning-first lane hierarchy.
- The parked-year recovery path still worked: selecting parked year `2015` moved it back into the primary lane and raised the selection count from `3` to `4`.
- The five-year case was completed through the live manual-year seam: year `2016` was completed, then the workspace imported `2015, 2016, 2022, 2023, 2024`. Step 3 then showed all five imported years in the support-rail summary.
- The row edit/save path still behaved locally on the five-year workspace: year `2024` opened in `Full manuell korrigering`, `Material och tjänster` changed from `0` to `1`, and `Spara årsdata` updated the card in place while the reviewed count advanced from `0` to `1`.
- Excluding `2015` from the plan updated the support rail summary immediately, reducing imported years to `4`, increasing excluded years to `1`, and keeping `Underlag klart` locked until the remaining review decisions are resolved.
- Baseline context stayed coherent throughout: the support rail kept imported-year totals, reviewed count, excluded-year count, and next-step guidance visible while the review queue changed.

Connected wizard re-audit conclusion:
whole queue succeeded

---

Login and year-card truth rerun

Date: 2026-03-22
Mode: local browser live audit
Environment:
- Web: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:3000`
- Workspace: `admin@vesipolku.dev`

Automated regression status:
- `pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/App.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts` -> PASS
- `pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts` -> PASS
- `pnpm --filter ./apps/web typecheck` -> PASS
- `pnpm --filter ./apps/api typecheck` -> PASS

Observed result:
- Fresh unauthenticated open on `http://127.0.0.1:4173` showed the calmer login entry: one text-first `Vesipolku` mark, a shorter heading, and literal FI value statements without the old pill-logo treatment or `samaan näkymään` filler.
- Logging in with `admin@vesipolku.dev` / `admin123` opened the existing Kronoby workspace at step 3 with imported years `2024`, `2023`, and `2022`.
- Opening year `2022`, choosing `Full manuell korrigering`, changing `Material och tjänster` from `10 525` to `194 000`, and saving updated the visible year card immediately: the visible `Resultat` dropped from `194 103 EUR` to `10 628 EUR`.
- The old result-commentary block was gone in the live UI: no `kaukana nollasta`, no surplus/deficit narration, and no saved-result-field note rendered under the card after the change.
- Returning to step 2 showed the same updated `2022` card value (`Resultat 10 628 EUR`) and the compact secondary tiles rendered cleanly with calmer labels such as `Vattenpris`, `Avloppspris`, `Sålt vatten`, and `Sålt avlopp` without the earlier broken uppercase overflow.

Login and year-card truth rerun conclusion:
whole queue succeeded

---

Connected wizard re-audit rerun

Date: 2026-03-23
Mode: local browser live audit
Environment:
- Web: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:3000`
- Existing workspace: `admin@vesipolku.dev`
- Connected audit workspace: `timing.audit.b@dev.local`

Automated regression status:
- `pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts` -> PASS
- `pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts` -> PASS
- `pnpm --filter ./apps/web typecheck` -> PASS
- `pnpm --filter ./apps/api typecheck` -> PASS

Observed result:
- Fresh open on `http://127.0.0.1:4173` still started on the Finnish login surface, and `admin@vesipolku.dev` still opened the existing Kronoby workspace directly on step `3 / 6`.
- That existing workspace kept the connected support rail truthful: imported years `2024, 2023, 2022`, one reviewed year, zero excluded years, and Forecast/Reports still locked while the remaining review queue stayed unresolved.
- The dedicated audit workspace `timing.audit.b@dev.local` could be reset safely from the account drawer with confirmation code `4134F504`; after the reset, the flow returned to step `1 / 6`.
- Direct ID search `1535` still selected `Kronoby vatten och avlopp ab`, and `Anslut valt verk` advanced the flow to step `2 / 6` without a stale or duplicate support rail.
- The step-2 board still used the warning-first lane hierarchy. Recovering the parked year `2015` by selecting it from the parked disclosure worked immediately, and the selected-year count rose from `3` to `4`.

Blocker:
- The current connected rerun does not expose a five-year import case anymore. After reset and reconnect on `2026-03-23`, the available candidate years were `2022`, `2023`, `2024`, plus parked `2015`. No fifth candidate year was present on the live import board, so the prior five-year import/recovery path could not be reproduced from the current VEETI-backed data.

Connected wizard re-audit rerun conclusion:
queue stopped on blocker: current live data no longer reproduces a five-year import case

---

Connected wizard re-audit continuation

Date: 2026-03-23
Mode: local browser live audit
Environment:
- Web: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:3000`
- Existing workspace: `admin@vesipolku.dev`
- Connected audit workspace: `timing.audit.b@dev.local`

Observed continuation:
- The earlier blocker was resolved by continuing the real UI flow instead of stopping at the first visible year count. After reconnect, the blocked and parked lanes still exposed additional candidate years below the initial viewport.
- `2016` was recovered through the normal manual-completion path on step 2:
  - `Komplettera manuellt` -> set `Omsättning` to `1 000` and save
  - `Rätta priser` -> set `Vatten enhetspris` to `1` and save
  - `Rätta volymer` -> set `Såld avloppsvolym` to `1` and save
- After those saves, `2016` moved out of the blocked lane into the parked lane as a mixed-source year. Selecting it raised the step-2 selected-year count from `4` to `5`.
- Importing the selected years advanced the workspace to step `3 / 6` with a real five-year connected case in the support rail summary: imported years `2024, 2023, 2022, 2016, 2015`.
- The row edit/save path still worked on that five-year workspace. Opening year `2015`, choosing `Full manuell korrigering`, changing `Material och tjänster` from `0` to `1`, and using `Spara årsdata` updated the card immediately.
- After that save, the support rail summary stayed coherent on the five-year workspace:
  - imported years: `5`
  - reviewed years: `2` (`2016`, `2015`)
  - excluded years: `0`
  - baseline still locked while unresolved years remained, which matched the current workflow truth.

Connected wizard re-audit continuation conclusion:
whole queue succeeded
