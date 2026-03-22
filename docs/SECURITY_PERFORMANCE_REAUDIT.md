# Security / Performance Re-audit

Date: 2026-03-22

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

- Web tests: 140 passed, 3 skipped
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

- `assets/index-DovtDj8g.css` 156.43 kB
- `assets/v2-yRsjJn9J.css` 53.25 kB
- `assets/vendor-charts-VOs6LYrj.js` 227.02 kB
- `assets/statementOcr-WymIhLe4.js` 2.90 kB
- `assets/qdisPdfImport-KZNJvP4H.js` 4.56 kB
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
- `Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.jrwl.io https://cloudflareinsights.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
- `Cross-Origin-Opener-Policy: same-origin`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `cf-cache-status: DYNAMIC`

Observed API headers on `https://api.jrwl.io/health/live`:

- `Cross-Origin-Opener-Policy: same-origin`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`

Interpretation:

- The repo now versions the desired frontend header policy in `infra/nginx/vesipolku.frontend-headers.conf`.
- The live frontend edge now reflects the repo-defined header policy that previously remained deployment-only.

## Production dependency audit

Command:

```bash
pnpm audit --prod --json
```

Result: PASS

Observed result:

- `0 advisories`
- production dependency graph cleared after forcing patched `multer`, `file-type`, and `minimatch` versions into the install graph

## Release gate rerun

Command:

```bash
pnpm release-check
```

Result: PASS

Observed result:

- `pnpm audit --prod --json`: `0 advisories`
- `pnpm --filter ./apps/api test:upload-security`: 52 passed
- `pnpm check:prisma-lock`: PASS after removing one stale Prisma temp DLL
- `pnpm lint`: PASS with existing warnings only, no errors
- `pnpm typecheck`: PASS
- `pnpm test`: web 194 passed, 3 skipped; API 172 passed; packages/domain PASS
- `pnpm --filter ./apps/api build`: PASS
- `pnpm --filter ./apps/web build`: PASS
- `pnpm smoke:v2`: 34 passed
- `prisma-generate-safe` reported a Windows engine rename lock fallback, reused the existing generated client, and the overall release gate still completed successfully

## Residual blockers

None inside the executable repo scope. The deployment-side frontend header rollout landed by 2026-03-22 and the live edge now emits the repo-defined policy.

## Outcome

The queue materially improved runtime safety and load behavior:

- upload boundaries are bounded and early-reject invalid files
- the vulnerable runtime workbook parser path no longer uses `xlsx`
- auth throttling now depends on trusted `req.ip` identity and an explicit production edge contract
- browser demo-secret shipping is removed
- legal hot paths are read-only and repeated auth/legal checks are cached
- OCR/PDF and chart assets stay off the login/default Overview first load

The previous deployment-state header blocker is cleared. With the focused re-audit bundle, live browser proof, live header verification, production dependency audit, and full release gate all passing, `S-156` now has complete acceptance evidence.
