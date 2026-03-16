# Wizard Review Loop Re-audit

Date: 2026-03-16

Scope:
- Fresh local browser audit from `Tili -> Tyhjennä tietokanta`
- Walk the wizard through steps `1..6`
- Confirm no-change approval, review-first mode, locale parity, missing-state previews, and review-queue auto-advance in a live session

Result:
- stopped by blocker: the available local browser runtime could not complete a trustworthy live audit because the frontend browser path and backend health path diverged on localhost routing.

Observed local runtime facts:
- `http://127.0.0.1:3000/demo/status` returned the expected backend JSON response.
- `http://localhost:3000/demo/status` returned `404 Not Found`.
- Fresh Vite sessions still resolved frontend `/api/*` calls through `localhost:3000`, so the browser saw `Cannot GET /demo/status` even though the backend was healthy on `127.0.0.1:3000`.
- A second frontend session with `VITE_API_BASE_URL=http://127.0.0.1:3000` reached the backend, but browser requests then failed on CORS.
- The Playwright transport crashed while attempting a request-interception workaround, so the live audit could not be completed inside this run without changing runtime/network configuration outside the sprint file scope.

Product state before the blocker:
- Focused regressions passed for `AppShellV2`, `OverviewPageV2`, `yearReview`, and locale integrity.
- The shipped wizard code now supports no-change approval, review-first year detail, explicit missing-state previews, and review-queue auto-advance.

Next step required to finish the live audit:
- Run the browser against a frontend session whose `/api` path resolves to the same backend instance as `127.0.0.1:3000`, or provide a browser session with direct backend access and allowed CORS.
