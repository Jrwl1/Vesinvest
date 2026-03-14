# Setup Wizard UI/UX Re-audit

Date: 2026-03-15
Mode: local browser smoke audit
Environment:
- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- API mode: `trial` (`GET /demo/status` returned `{"enabled":false,"appMode":"trial","authBypassEnabled":false,"demoLoginEnabled":false,"orgId":null,"message":"Demo mode is not enabled."}`)

Authenticated entry used:
- Email: `admin@vesipolku.dev`
- Password: `admin123`

Target flow:
1. Clear
2. Search
3. Connect
4. Explicit import
5. Review continue
6. Blocked-year fix or exclude
7. Baseline
8. Unlock forecast/reports

Observed result:
- Account-drawer clear accepted confirmation code `C9032CDE` and `POST /api/v2/import/clear` returned `201`.
- After clear, returning to `Yhteenveto` showed the wizard reset to `Vaihe 1 / 6`, with `Ennuste` and `Raportit` locked again.
- Search for `Kronoby` returned `Kronoby vatten och avlopp ab`, and connect advanced to `Vaihe 2 / 6`.
- Explicit import for the default selected years succeeded and moved the wizard to `Vaihe 3 / 6`.
- The imported Kronoby years (`2022`, `2023`, `2024`) were all `Valmis`, so the live dataset did not present a blocked imported year in step 3. The blocked-year branch remained covered by the committed regression proof from `S-47` substeps 1-3.
- `Jatka` moved to `Vaihe 5 / 6`.
- `Luo suunnittelupohja` was enabled and created the planning baseline successfully.
- The wizard advanced to `Vaihe 6 / 6`, and both `Ennuste` and `Raportit` unlocked.
- Opening `Ennuste` loaded the scenario workspace, and opening `Raportit` loaded the reports workspace.

Notes:
- The earlier local `workspaceYears` migration issue and the step-5 baseline gating bug were both cleared before this rerun.
- The live Kronoby data set is now clean enough that the manual blocked-year fix/exclude branch is not exercised during the re-audit path after import.

Conclusion:
whole sprint succeeded
