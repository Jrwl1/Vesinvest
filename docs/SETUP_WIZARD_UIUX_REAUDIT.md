# Setup Wizard UI/UX Re-audit

Date: 2026-03-20
Mode: local browser live audit
Environment:
- Web: `http://127.0.0.1:5173`
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
- The existing `admin@vesipolku.dev` workspace opens directly into step 3 with the corrected Kronoby years visible as `Redo för granskning`.
- On that existing workspace, `Fortsätt` still jumps to the step-6 handoff surface, but the shell keeps `Prognos` and `Rapporter` disabled and the `Öppna Prognos` CTA does not navigate away from `Yhteenveto`.
- A fresh isolated org (`timing.audit.c@dev.local`) starts truthfully from login -> legal accept -> step 1 search -> step 2 connect/import.
- On that fresh isolated org, importing the default selected years (`2022`, `2023`, `2024`) moves the wizard to step 3, but all three imported years render as `Kräver åtgärd` because `Bokslut` is missing, so the live flow does not reach a clean approval/baseline/step-6 path.

Notes:
- The focused regression bundle added in `S-136` now locks the exact VEETI-id lookup path and the step-6 handoff consistency fix in tests.
- The running local browser flow still reproduces the step-6 unlock mismatch on the existing workspace and the fresh-org financial completeness failure after import.

Conclusion:
blocker recorded
