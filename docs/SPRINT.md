# Sprint

Window: 2026-03-09 to 2026-05-30

Executable DO queue. Execute top-to-bottom.
Each `Do` cell checklist must stay flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Execution policy: after `DO` or `RUNSPRINT` entry, run continuous `DO -> REVIEW` cycles until all active rows are `DONE` or a protocol stop condition/blocker is reached.
Clean-tree policy: protocol cleanliness is defined by `git status --porcelain`; ignored local files are out of scope, while tracked changes and untracked non-ignored files still block DO/REVIEW completion.
DO file-scope policy: when a selected substep explicitly lists non-canonical repo docs or config examples in `files:`, DO may edit them as product-scope files; canonical planning docs remain forbidden.
Required substep shape:

- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean`
  Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
  `DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

Turn the post-refresh audit into a customer-trust hardening pass on `main`: remove dangerous admin UX, clean up login/demo entry behavior, make Forecast state authority explicit, eliminate mixed-language leaks, and close the highest-value desktop accessibility gaps.

## Recorded decisions (this sprint)

- Mobile-specific polish is deferred; this sprint targets desktop trust and operator workflow clarity.
- Admin-destructive actions must be visibly gated in the UI and independently enforced by the backend.
- Forecast numbers must make authority obvious: users should always know whether values are current, stale, computing, or save-only draft state.
- Mixed-language leakage across the exercised V2 flow is treated as a product-trust bug, not a cosmetic issue.
- Demo/dev behavior must present one visible truth across backend status, login affordances, and docs; silent mismatch is not acceptable.
- Low-priority SEO/dev-artifact cleanup stays in backlog unless this hardening pass uncovers production-facing impact.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-31 | Harden the destructive account-clear flow so the UI and backend both require an explicit visible confirmation before any org-clear action can run. See S-31 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/api.ts, apps/web/src/v2/AppShellV2.test.tsx, apps/api/src/** | The account/admin modal shows the confirmation token input every time, keeps destructive actions disabled until the exact token matches, and the backend rejects missing/invalid confirmation even if the frontend is bypassed. | DONE: acceptance verified against commits `5458997`, `e9bd551`, `23bc7c4`, and `ac6c1cc`; the V2 drawer keeps the destructive action disabled until the visible token matches, and backend enforcement rejects missing/invalid confirmation with deterministic validation output. | Stop if the clear-database path cannot be traced to a single backend enforcement point, or if hardening it would require changing unrelated tenant lifecycle behavior. | DONE |
| S-32 | Clean up login and entry-path trust so first-run copy, demo/trial affordances, and docs all describe the same real behavior. | apps/web/src/components/LoginForm.tsx, apps/web/src/App.tsx, apps/web/src/context/DemoStatusContext.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/.env.example, README.md, DEPLOYMENT.md | Login no longer uses legacy asset-management copy, the login surface clearly reflects backend demo availability or unavailability, and local/dev docs/env examples match shipped runtime behavior. | DONE: acceptance verified against commits `956075d`, `08fc3cf`, `1ff2ce5`, `7cc0c18`, `74e1cea`, and `e7e3632`; the login flow now uses Vesipolku planning language, renders explicit demo availability states, documents default non-production trial mode accurately, and keeps the demo entry-state mapping under regression coverage. | Stop if the team cannot determine the intended dev/demo default from current shipped behavior and docs without a customer/product decision. | DONE |
| S-33 | Make Forecast state authority explicit so users can distinguish unsaved changes, saved-but-stale inputs, current computed outputs, and active computation without guesswork. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/web/src/v2/EnnustePageV2.test.tsx | Forecast exposes one clear state model across banners, KPI labels, compute/save controls, and report readiness messaging; users can tell whether displayed results are current or stale at a glance. | DONE: acceptance verified against commits `5c32663`, `f24a16d`, `7178a83`, `a0df3de`, and docs commit `c181a46`; Forecast now exposes one shared freshness model across scenario badges, surface authority styling, CTA labels, and report-readiness messaging, with `src/v2` tests and web typecheck passing in review. | Stop if the required clarity would change compute semantics or projection math instead of presentation/state handling. | DONE |
| S-34 | Harden Forecast result authority and navigation restoration so save-only edits never look computed and back/forward navigation rebuilds trustworthy action readiness. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx | Computed KPI cards and charts update only from compute-backed data, save-only changes stay visibly draft/input state, and returning between Forecast and Reports restores action readiness from current canonical data instead of stale local state. | DONE: acceptance verified against commits `ff7853a`, `951ebc9`, `00765d9`, `3ce839c`, and docs commits `55547da` / `dbbc9c6` / `97dada8` / `d10f0bc`; save-only PATCH responses preserve compute-backed KPI/chart/report surfaces, AppShell-backed Forecast runtime state restores selected scenario plus valid compute tokens across remounts, report-focused navigation restores the matching Forecast context, and targeted trust regressions pass with `pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck`. | Stop if fixing navigation/state restoration requires new backend contracts rather than frontend state derivation and reload logic. | DONE |
| S-35 | Remove mixed-language leakage and copy drift across the exercised V2 flow so Finnish, Swedish, and English each read as one intentional product. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/components/LoginForm.tsx, apps/web/src/i18n/locales/, apps/web/src/api.ts | The exercised Overview, Forecast, Reports, and login flow contain no stray English in FI, no stray Finnish/Swedish in EN, and no unexplained raw domain labels except intentional canonical system names like VEETI. | DONE: acceptance verified against commits `6dee7dd`, `6c92a53`, `28c5017`, and `1177cf3`; component-layer fallback copy routes through locale keys, exercised FI/SV/EN locale surfaces are covered and cleaned, locale integrity now guards the refreshed trust/admin keys plus leaked-token checks, and full web `src` regression plus typecheck pass with locale-backed V2 test assertions. | Stop if visible mixed-language strings are sourced from backend-owned canonical values that cannot be safely translated at the UI boundary. | DONE |
| S-36 | Close the highest-value desktop accessibility and release-polish gaps from the audit, then rerun the full desktop-quality gates. | apps/web/src/components/LanguageSwitcher.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/v2/, e2e/ | The desktop app resolves the audited accessible-name and field-label issues, preserves keyboard clarity across the refreshed V2 flow, and passes final web/root quality gates with the hardening changes in place. | IN_PROGRESS: substep 1 verified against `385d796`; desktop language buttons now use matching visible and accessible labels, and targeted component coverage keeps the shell labels under `src` regression plus web typecheck. | Stop if acceptance would require mobile-specific redesign or unrelated SEO work outside the audited desktop trust/accessibility scope. | IN_PROGRESS |

### S-31 substeps

- [x] Trace the current clear-database flow from the V2 account modal to the backend handler so hardening lands on the real destructive path
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/api.ts, apps/api/src/**
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:5458997 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.controller.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts,apps/web/src/v2/AppShellV2.tsx | docs:N/A | status: clean

- [x] Add a visible confirmation input and exact-match disable logic to the account/admin modal so the destructive action cannot be triggered accidentally from the UI
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:e9bd551 | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/AppShellV2.test.tsx,apps/web/src/v2/AppShellV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [ ] Enforce the same confirmation token requirement on the backend clear path and return a deterministic validation error when the token is missing or wrong
- [x] Enforce the same confirmation token requirement on the backend clear path and return a deterministic validation error when the token is missing or wrong
  - files: apps/api/src/**, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src
  - evidence: commit:23bc7c4 | run:pnpm --filter ./apps/api test -- src -> PASS | files:apps/api/src/v2/dto/import-clear.dto.ts,apps/api/src/v2/v2.controller.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts,apps/web/src/v2/AppShellV2.test.tsx,apps/web/src/v2/AppShellV2.tsx | docs:N/A | status: clean

- [x] Add regression coverage for the destructive-flow gating and verify the web/api workspaces stay green after the safety hardening
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/api/src/**, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/api test -- src && pnpm --filter ./apps/web typecheck
  - evidence: commit:ac6c1cc | run:pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/api test -- src && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts | docs:N/A | status: clean

### S-32 substeps

- [x] Replace legacy login product copy with Vesipolku planning language and align the login screen text with the actual Overview -> Forecast -> Reports workflow
  - files: apps/web/src/components/LoginForm.tsx, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: commit:956075d | run:pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts -> PASS | files:apps/web/src/components/LoginForm.tsx,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json | docs:N/A | status: clean

- [ ] Make login explicitly show demo availability, demo unavailability, and backend-unreachable states instead of silently hiding the entry path
- [x] Make login explicitly show demo availability, demo unavailability, and backend-unreachable states instead of silently hiding the entry path
  - files: apps/web/src/App.tsx, apps/web/src/context/DemoStatusContext.tsx, apps/web/src/components/LoginForm.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src && pnpm --filter ./apps/web typecheck
  - evidence: commit:08fc3cf | run:pnpm --filter ./apps/web test -- src && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.tsx,apps/web/src/components/LoginForm.test.tsx,apps/web/src/components/LoginForm.tsx,apps/web/src/context/DemoStatusContext.tsx | docs:N/A | status: clean

- [x] Align demo-mode docs and env examples with the shipped runtime truth so local/dev setup instructions no longer contradict the live login behavior
  - files: README.md, DEPLOYMENT.md, apps/api/.env.example, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:1ff2ce5 | run:pnpm --filter ./apps/web typecheck -> PASS | files:DEPLOYMENT.md,README.md,apps/api/.env.example,apps/web/src/api.ts | docs:74e1cea | status: clean

- [ ] Add or update regression coverage for login/demo state rendering so first-run entry behavior stays trustworthy after future auth changes
- [x] Add or update regression coverage for login/demo state rendering so first-run entry behavior stays trustworthy after future auth changes
  - files: apps/web/src/App.tsx, apps/web/src/components/LoginForm.tsx, apps/web/src/context/DemoStatusContext.tsx
  - run: pnpm --filter ./apps/web test -- src && pnpm --filter ./apps/web typecheck
  - evidence: commit:7cc0c18 | run:pnpm --filter ./apps/web test -- src && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/context/DemoStatusContext.test.tsx,apps/web/src/context/DemoStatusContext.tsx | docs:e7e3632 | status: clean

### S-33 substeps

- [x] Define and wire one explicit Forecast freshness/state model that covers unsaved changes, saved-needs-recompute, computing, and current computed results
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:5c32663 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx | docs:9e7496e | status: clean

- [x] Update Forecast banners, CTA labels, and helper copy so every state uses the same vocabulary about what is current versus stale
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: commit:f24a16d | run:pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Mark KPI and chart surfaces with their current/stale authority so computed outputs never read as current when they are based on earlier inputs
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:7178a83 | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Tie report-creation readiness messaging to the same state model and verify Forecast still passes typecheck and targeted V2 regression coverage
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: commit:a0df3de | run:pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

### S-34 substeps

- [x] Separate draft/input summaries from compute-backed output cards so save-only actions cannot mutate the authoritative KPI surfaces
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:ff7853a | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

- [x] Rebuild Forecast action readiness from canonical scenario/report data on mount and navigation changes instead of trusting stale local state
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:951ebc9 | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/AppShellV2.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

- [x] Tighten back/forward restoration between Forecast and Reports so returning users see stable selected context and accurate report-creation affordances
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx
  - run: pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: commit:00765d9 | run:pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/AppShellV2.tsx,apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [ ] Add regression coverage for save-vs-compute authority and navigation restoration so the trust model stays stable across future Forecast changes
- [x] Add regression coverage for save-vs-compute authority and navigation restoration so the trust model stays stable across future Forecast changes
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: commit:3ce839c | run:pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/AppShellV2.test.tsx,apps/web/src/v2/EnnustePageV2.test.tsx | docs:N/A | status: clean

### S-35 substeps

- [x] Inventory and replace visible hardcoded strings in Overview, Forecast, Reports, and login so the exercised flow no longer mixes languages at the component layer
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/components/LoginForm.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:6dee7dd | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/components/LoginForm.tsx,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [ ] Normalize source and domain labels at the translation boundary so canonical system names stay intact while user-facing descriptors translate cleanly
- [x] Normalize source and domain labels at the translation boundary so canonical system names stay intact while user-facing descriptors translate cleanly
  - files: apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: commit:6c92a53 | run:pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [x] Sweep FI, SV, and EN locale files for the exercised trust/admin copy so the refreshed V2 flow reads as one product in every shipped language
  - files: apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: commit:28c5017 | run:pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json | docs:N/A | status: clean

- [x] Add or update regression checks for the translated surfaces touched in this sweep and verify the web workspace stays green
  - files: apps/web/src/v2/, apps/web/src/components/LoginForm.tsx, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src && pnpm --filter ./apps/web typecheck
  - evidence: commit:1177cf3 | run:pnpm --filter ./apps/web test -- src && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/localeIntegrity.test.ts,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/ReportsPageV2.test.tsx | docs:N/A | status: clean

### S-36 substeps

- [x] Fix language-switcher accessible names so visible labels and assistive labels match on the desktop shell
  - files: apps/web/src/components/LanguageSwitcher.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src && pnpm --filter ./apps/web typecheck
  - evidence: commit:385d796 | run:pnpm --filter ./apps/web test -- src && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/components/LanguageSwitcher.test.tsx,apps/web/src/components/LanguageSwitcher.tsx | docs:N/A | status: clean

- [ ] Add explicit labels or labelled-by wiring for the investment editor inputs and selects that were unlabeled in the audit
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: commit:pending | run:pending | files:pending | docs:N/A | status: pending

- [ ] Recheck keyboard focus order and desktop interactive affordances after the hardening changes so the refreshed shell remains legible under keyboard-only use
  - files: apps/web/src/v2/, apps/web/src/App.css
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:pending | run:pending | files:pending | docs:N/A | status: pending

- [ ] Run final desktop-focused web and root quality gates after the trust, language, and accessibility fixes land
  - files: apps/web/, apps/api/, e2e/, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src && pnpm lint && pnpm typecheck && pnpm test
  - evidence: commit:pending | run:pending | files:pending | docs:N/A | status: pending
