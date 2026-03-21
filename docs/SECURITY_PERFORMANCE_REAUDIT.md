# Security / Performance Re-audit

Date: 2026-03-21

## Scope

Re-audit the `S-149..S-155` remediation queue after:

- upload boundary hardening and workbook parser replacement
- trusted proxy auth identity and explicit edge-backed auth throttling contract
- browser demo-secret removal
- auth/legal hot-path query reduction
- OCR/PDF and chart bundle splitting
- repo-visible frontend header policy and fail-closed release-gate wiring

## Automated regression bundle

Command:

```bash
pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts src/v2/v2.service.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
```

Result: PASS

- Web tests: 135 passed, 3 skipped
- API tests: 53 passed
- Web typecheck: PASS
- API typecheck: PASS

## Production build output

Command:

```bash
pnpm --filter ./apps/web build
```

Result: PASS

Key emitted assets:

- `assets/index-Csr6j11c.css` 156.10 kB
- `assets/v2-CGzOsKsX.css` 52.66 kB
- `assets/vendor-charts-I8pVz-g5.js` 226.98 kB
- `assets/statementOcr-ZFJ0rzWS.js` 2.30 kB
- `assets/qdisPdfImport-BnsUXv8y.js` 4.55 kB
- `assets/pdf.worker.min-B_fnEKel.mjs` 1239.05 kB

Interpretation:

- auth/login CSS and workspace V2 CSS are now split into separate build assets
- chart code remains isolated in `vendor-charts`
- statement OCR / QDIS import helpers remain isolated in their own on-demand chunks

## Live local browser proof

Audited target:

- frontend: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:3000`

Observed network behavior:

- Initial login path plus authenticated Overview requests `1..59` did **not** request `statementOcr.ts`, `qdisPdfImport.ts`, `pdfjs-dist`, `tesseract.js`, `/vendor/tesseract/*`, or the chart bundle.
- After selecting a real statement PDF in the year-review import flow, requests `60..71` loaded:
  - `src/v2/statementOcr.ts`
  - `pdfjs-dist`
  - `pdf.worker.min.mjs`
  - `tesseract.js`
  - `/vendor/tesseract/worker.min.js`
  - `/vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js`
  - `/vendor/tesseract/lang/swe.traineddata.gz`
  - `/vendor/tesseract/lang/eng.traineddata.gz`
- This confirms the heavy OCR/PDF assets are on-demand rather than part of login/default Overview first load.

Observed console state:

- No new post-authenticated runtime errors during the audited import-flow interaction.
- One `401` console/network error was observed during an intentional failed login attempt before the successful login and is not treated as a product regression.

## Production header check

Command:

```bash
curl -I https://vesipolku.jrwl.io
curl -I https://api.jrwl.io/health/live
```

Observed frontend edge headers on `https://vesipolku.jrwl.io`:

- `Content-Type: text/html`
- `Server: cloudflare`
- `cf-cache-status: DYNAMIC`

Missing from the live frontend response at audit time:

- `Content-Security-Policy`
- `Cross-Origin-Opener-Policy`
- `Referrer-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`

Observed API headers on `https://api.jrwl.io/health/live`:

- `Cross-Origin-Opener-Policy: same-origin`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`

Interpretation:

- The repo now versions the desired frontend header policy in `infra/nginx/vesipolku.frontend-headers.conf`.
- The live frontend edge does **not yet** reflect that policy.

## Production dependency audit

Command:

```bash
pnpm audit --prod --json
```

Result: PASS

Observed result:

- `0 advisories`
- production dependency graph cleared after forcing patched `multer`, `file-type`, and `minimatch` versions into the install graph

## Residual blockers

1. The live frontend edge at `https://vesipolku.jrwl.io` does not yet emit the repo-defined header policy. This needs deployment-side nginx / edge rollout, not more repo-only edits from this workspace because current deploy SSH access is unavailable (`Permission denied (publickey)`).

## Outcome

The queue materially improved runtime safety and load behavior:

- upload boundaries are bounded and early-reject invalid files
- the vulnerable runtime workbook parser path no longer uses `xlsx`
- auth throttling now depends on trusted `req.ip` identity and an explicit production edge contract
- browser demo-secret shipping is removed
- legal hot paths are read-only and repeated auth/legal checks are cached
- OCR/PDF and chart assets stay off the login/default Overview first load

The remaining gap is deployment-state only: the live frontend edge still needs a successful rollout of the repo-defined header policy.
