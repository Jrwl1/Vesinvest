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
