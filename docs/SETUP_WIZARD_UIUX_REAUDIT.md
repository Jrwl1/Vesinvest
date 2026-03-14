# Setup Wizard UI/UX Re-audit

Date: 2026-03-14
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
- Normal sign-in succeeded and loaded the V2 shell.
- The shell header showed workspace chip `C9032CDE`.
- The main content did not render the setup wizard. It only showed `Yhteenvetodataa ei ole saatavilla.`
- Browser network inspection showed:
  - `GET /api/v2/overview` -> `500`
  - `GET /api/v2/context` -> `500`
- Both responses returned:
  - `{"statusCode":500,"message":"An error occurred while saving. Please try again or contact support.","error":"Internal Server Error"}`

Impact:
- The authenticated overview bootstrap failed before the wizard could render.
- Because the wizard never mounted, the audit could not proceed to clear, search, connect, import, review, blocked-year handling, baseline creation, or unlock handoff.

Conclusion:
stopped by blocker: authenticated Finnish Kronoby re-audit could not start because `/api/v2/overview` and `/api/v2/context` returned `500` after login, so the setup wizard never rendered.
