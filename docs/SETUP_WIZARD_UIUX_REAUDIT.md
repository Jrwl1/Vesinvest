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
