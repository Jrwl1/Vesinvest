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

## Rerun notes

- The previous 2026-03-14 blocker (`/api/v2/overview` and `/api/v2/context` returning `500`) was cleared before this rerun by applying the missing local DB migration for `workspaceYears`.
- On this rerun, normal sign-in succeeded and the wizard rendered for Kronoby at `Vaihe 2 / 6`.
- The shell header showed workspace chip `Kronoby vatten och avlopp ab · C9032CDE`.
- `Ennuste` and `Raportit` were correctly locked before baseline completion.

## Current observed blocker

- The requested first audit action was the account-drawer clear flow.
- In the drawer, the confirmation helper correctly required `C9032CDE`, and the field accepted the matching code.
- Clicking `Tyhjennä tietokanta` did not restart the wizard from step 1.
- Browser network inspection showed:
  - `POST /api/v2/import/clear` -> `401`
- The drawer surfaced `Session expired. Please log in again.`
- After reload and fresh sign-in, the UI returned to the same connected Kronoby `Vaihe 2 / 6` state instead of a cleared step-1 search/connect state.

Impact:
- The audit could not complete the required `clear -> search -> connect -> explicit import -> review continue -> blocked-year fix/exclude -> baseline -> unlock` sequence from a clean start.
- Because the clear action failed, the flow could not be re-executed truthfully from step 1 inside this re-audit pass.

Conclusion:
stopped by blocker: the authenticated Finnish Kronoby re-audit now reaches the wizard, but `POST /api/v2/import/clear` returns `401` even with an `ADMIN` session and the matching confirmation code, so the required clear-first flow cannot proceed.
