# Architectural Decision Records (ADR-lite)

Decisions proven from code and configuration. Date reflects when documented, not necessarily when decided.

---

## ADR-001: pnpm monorepo with workspaces

**Date:** 2026-02-08
**Decision:** Use pnpm workspaces for a monorepo containing API, web, and shared packages.
**Context:** `pnpm-workspace.yaml` defines `apps/*` and `packages/*`. Root `package.json` has parallel dev/build/lint/test scripts. `packageManager: "pnpm@9.15.4"`.
**Consequences:** Single install, shared lockfile, consistent tooling. Requires pnpm (not npm/yarn). Corepack used in Docker/CI for version pinning.

Source: `pnpm-workspace.yaml`, `package.json`

---

## ADR-002: NestJS for the backend

**Date:** 2026-02-08
**Decision:** Use NestJS 9 as the backend framework.
**Context:** `apps/api/package.json` lists `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/passport`, `@nestjs/jwt`. Modular architecture with 17 modules.
**Consequences:** Opinionated structure (modules, controllers, services). Decorator-based routing. Built-in DI. Guards for auth and tenancy. Good Prisma integration.

Source: `apps/api/package.json`, `apps/api/src/app.module.ts`

---

## ADR-003: Prisma ORM with PostgreSQL

**Date:** 2026-02-08
**Decision:** Use Prisma 5.22 as the ORM with PostgreSQL 16.
**Context:** `prisma/schema.prisma` defines 20+ models. Migrations in `prisma/migrations/`. `PrismaService` wraps client with connection retry and health checks. `PrismaExceptionFilter` converts Prisma errors to HTTP responses.
**Consequences:** Type-safe database access. Auto-generated client. Migration-based schema evolution. Windows has occasional `EPERM` issues with the query engine DLL (requires killing Node processes).

Source: `apps/api/prisma/schema.prisma`, `apps/api/src/prisma/prisma.service.ts`

---

## ADR-004: Finnish domain terminology in Prisma models

**Date:** 2026-02-08
**Decision:** Use Finnish names for domain models and fields in Prisma, with ASCII-safe identifiers and `@map()` for database columns.
**Context:** Models: `Talousarvio`, `TalousarvioRivi`, `Tuloajuri`, `Olettamus`, `Ennuste`, `EnnusteVuosi`. Field example: `yksikkohinta` (maps to DB column via `@map`). Avoids TypeScript issues with diacritics while preserving domain language.
**Consequences:** Code reads like the domain (Finnish water utility finance). Developers need domain glossary. `@map()` keeps DB columns clean. Full Finnish terms appear in UI via i18n.

Source: `apps/api/prisma/schema.prisma`

---

## ADR-005: JWT authentication with Passport

**Date:** 2026-02-08
**Decision:** Use Passport JWT strategy for authentication, with a TenantGuard for multi-tenancy.
**Context:** `passport-jwt` extracts token from Bearer header. `JwtAuthGuard` validates. `TenantGuard` extracts `org_id` from claims and sets `req.orgId`. Demo mode bypasses JWT validation.
**Consequences:** Stateless auth. No session storage needed. Token contains org_id for tenant isolation. Demo mode is a special case handled in guards. 1h token expiry (24h for demo).

Source: `apps/api/src/auth/jwt.strategy.ts`, `apps/api/src/auth/jwt.guard.ts`, `apps/api/src/tenant/tenant.guard.ts`

---

## ADR-006: React + Vite for the frontend

**Date:** 2026-02-08
**Decision:** Use React 18 with Vite 4 for the frontend. No SSR.
**Context:** `apps/web/package.json` lists `react`, `react-dom`, `vite`, `@vitejs/plugin-react`. SPA architecture with client-side routing via React Context (not react-router). Single `api.ts` fetch-based client.
**Consequences:** Fast HMR in dev. Simple SPA deployment (static files to Vercel). No server-side rendering — acceptable for B2B SaaS with authenticated users.

Source: `apps/web/package.json`, `apps/web/vite.config.ts`

---

## ADR-007: react-i18next for internationalization (FI/SV/EN)

**Date:** 2026-02-08
**Decision:** Use react-i18next with three locales: Finnish (default), Swedish, English.
**Context:** `apps/web/src/i18n/index.ts` configures i18next with JSON translation files. Language persisted in localStorage (`va_language`). `LanguageSwitcher` component in header.
**Consequences:** All user-facing text must use `t()` function with translation keys. Three files must be kept in sync. Finnish is the primary locale (matches target market).

Source: `apps/web/src/i18n/index.ts`, `apps/web/src/i18n/locales/`

---

## ADR-008: Railway for backend deployment, Vercel for frontend

**Date:** 2026-02-08
**Decision:** Deploy API to Railway (Docker/Nixpacks), web to Vercel.
**Context:** `railway.toml` configures Dockerfile builder with health check. `Dockerfile` is multi-stage (deps → build → runner). `nixpacks.toml` as alternative. Vercel deployment documented in `DEPLOYMENT.md`.
**Consequences:** Railway manages PostgreSQL and API process. Vercel serves static SPA. Separate scaling. Environment variables split between platforms.

Source: `railway.toml`, `Dockerfile`, `nixpacks.toml`, `DEPLOYMENT.md`

---

## ADR-009: Demo mode as a first-class feature

**Date:** 2026-02-08
**Decision:** Built-in demo mode that bootstraps a complete org with sample data, controllable via environment variables.
**Context:** `DemoBootstrapService` seeds org, user, budget, assumptions, projection. `DemoResetService` wipes and re-seeds. `demo.constants.ts` controls enablement. Demo is on by default in dev, off in production.
**Consequences:** Zero-config local development. Easy demos for stakeholders. Demo login is explicit (button click only, never auto). Demo data must be maintained as features evolve.

Source: `apps/api/src/demo/`, `apps/api/src/demo/demo.constants.ts`

---

## ADR-010: V1 deployment model is single-tenant per customer on Render

**Date:** 2026-02-10  
**Decision:** For V1 delivery, each customer is deployed as an isolated stack: one web app, one API service, and one Postgres database.  
**Context:** Customer delivery planning requires deployable isolation, clear ops boundaries, and no assumptions about shared multi-tenant runtime. Current code keeps org-scoped guards, which remain valuable defense-in-depth.  
**Consequences:**
- Simpler customer isolation and rollback boundaries.
- Higher per-customer ops overhead (secrets, backups, deploy cadence).
- Requires explicit per-customer runbooks and release gates.

Source: user instruction for this planning pass, `docs/client/*`, `docs/CANONICAL.md`

---

## ADR-011: V1 release requires explicit security and operations gate

**Date:** 2026-02-10  
**Decision:** No customer go-live without a must-pass release gate: build checks, security checklist, smoke/E2E gate, backup verification, and manual approval.  
**Context:** Current repository has no required CI gate configured for release control, while V1 handles business-critical financial planning data.  
**Consequences:**
- Slower but safer releases.
- Clear accountability for go-live decisions.
- Requires checklist evidence per release.

Source: `docs/ROADMAP.md`, `docs/CANONICAL_REPORT.md`, repository scripts in `package.json`

---

## Pending decisions required to exit M0

**Recorded:** 2026-02-10

1. VAT model for water/wastewater pricing in V1 (rationale: impacts pricing and projection correctness).
2. Final tariff/base fee rules (rationale: required for acceptance criteria and scenario testing).
3. Requirement level for connections and connection fees (rationale: affects data contract and UI/API scope).
4. Required first pilot output format (screen/CSV/PDF/regulatory) (rationale: defines deliverable acceptance).
5. Investment horizon requirement detail (full 20-year input now vs phased rollout) (rationale: determines V1 scope boundary).

---

## ADR-012: V1 calculations are VAT-free (0%)

**Date:** 2026-02-10
**Decision:** Budget and financial-statement values are treated as VAT-free in V1. VAT must not be included in V1 calculations.
**Context:** Customer clarified that all relevant values are VAT-free and VAT should not drive the model in V1.
**Consequences:**
- V1 acceptance criteria and planning assumptions are VAT-free.
- VAT handling can be revisited only in a post-V1 scope decision.

Source: customer clarification (planning session 2026-02-10), `docs/CANONICAL_REPORT.md`

---

## ADR-013: Base-fee model in V1 is annual total with yearly adjustment

**Date:** 2026-02-10
**Decision:** Grundavgift is modeled as annual total value with yearly percent change/override. No tariff table is required in V1.
**Context:** Customer confirmed manual adjustment is acceptable for V1.
**Consequences:**
- Faster and clearer V1 financial planning flow.
- Tariff-table modeling remains a later-scope option.

Source: customer clarification (planning session 2026-02-10), `docs/CANONICAL_REPORT.md`

---

## ADR-014: Connection fees are out of V1 scope

**Date:** 2026-02-10
**Decision:** Connection-fee modeling is not a V1 must-have. If needed in planning, it is treated as manual other income.
**Context:** Customer stated connection fees depend too much on uncertain new connections.
**Consequences:**
- V1 scope is tighter and more predictable.
- Dedicated connection-fee modeling is deferred to backlog/post-V1.

Source: customer clarification (planning session 2026-02-10), `docs/BACKLOG.md`

---

## ADR-015: Investment horizon minimum is 20 years

**Date:** 2026-02-10
**Decision:** V1 planning horizon for investments is minimum 20 years.
**Context:** Customer clarified this is a legal requirement.
**Consequences:**
- Milestones and acceptance criteria must enforce at least 20-year horizon.
- Shorter-horizon alternatives are out of V1.

Source: customer clarification (planning session 2026-02-10), `docs/ROADMAP.md`

---

## ADR-016: Depreciation must be shown as two separate components

**Date:** 2026-02-10
**Decision:** V1 must present depreciation split into:
1. Baseline depreciation derived from the 3 base years.
2. Additional depreciation from the investment plan.
**Context:** Customer requires visibility of both baseline burden and new-investment effect.
**Consequences:**
- Acceptance criteria and reporting structure must preserve this split.
- Combined single-line depreciation presentation is not enough for V1 acceptance.

Source: customer clarification (planning session 2026-02-10), `docs/PROJECT_STATUS.md`

---

## ADR-017: V1 PDF export is financing/cashflow focused

**Date:** 2026-02-10
**Decision:** V1 PDF must answer whether pricing covers future costs and investments. Output should be a cashflow diagram plus a compact table. Multi-page output is acceptable.
**Context:** Customer asked for decision support, not dense one-page output.
**Consequences:**
- PDF acceptance focuses on financing clarity and readability.
- One-page compression is explicitly not a requirement.

Source: customer clarification (planning session 2026-02-10), `docs/ROADMAP.md`

---

## ADR-018: Single-tenant hosted deployment per customer is reaffirmed for V1

**Date:** 2026-02-10
**Decision:** Reaffirm ADR-010: each customer is delivered as hosted single-tenant stack (web + API + DB), with release/security gates.
**Context:** Customer-ready V1 plan requires deployable hosted service, not local-only setup.
**Consequences:**
- Operations and security planning are per customer tenant.
- Shared-runtime multi-tenant deployment is not a V1 assumption.

Source: ADR-010, customer clarification (planning session 2026-02-10), `docs/ROADMAP.md`

---

## Decision status update for M0 clarifications (2026-02-10)

Resolved in ADR-012..ADR-018:
1. VAT policy.
2. Base-fee model.
3. Connection-fee scope.
4. Investment horizon requirement.
5. Depreciation split requirement.
6. PDF financing export goal.
7. Single-tenant hosted delivery model.

---

## ADR-019: OS command router is exact PLAN / DO / REVIEW

**Date:** 2026-02-10
**Decision:** The repository OS router matches only three exact command prefixes on the first user line: `PLAN`, `DO`, `REVIEW`.
**Context:** Repeated prompting was required because protocol entry rules were ambiguous.
**Consequences:**
- Future runs are deterministic.
- Any non-matching command must receive: `Use PLAN, DO, or REVIEW.`

Source: OS hardening plan pass (2026-02-10), `AGENTS.md`

---

## ADR-020: Historical M0 pending list is superseded by ADR-012..ADR-018

**Date:** 2026-02-10
**Decision:** The earlier section "Pending decisions required to exit M0" is historical context only; VAT/base fee/connection scope/horizon/depreciation/PDF/deployment decisions are already locked in ADR-012..ADR-018.
**Context:** Canonical consistency audit found contradictory interpretation risk.
**Consequences:**
- Planning must treat those items as resolved.
- Remaining open questions are only the explicit `B-TBD-*` customer items in backlog.

Source: OS hardening plan pass (2026-02-10), `docs/CANONICAL_REPORT.md`

---

## ADR-021: Talousarvio amounts and result use Option A sign convention

**Date:** 2026-02-12
**Decision:** All stored amounts (valisummat, rivit) are positive. Result (tulos) is derived as: tulos = tulot − kulut − poistot − investoinnit. Costs, depreciation, and investments are never stored as negative; the UI and import path must normalize to positive values.
**Context:** Product required a single sign convention end-to-end to prevent "kulut going green" or type inversion. Existing `BudgetPage.tsx` and repo already use this formula.
**Consequences:** Import adapters must ensure cost/depreciation/investment amounts are stored as positive; regression tests must assert expense/poisto/investointi lines never increase result.

Source: KVA Talousarvio re-plan (2026-02-12), `docs/SPRINT.md`

---

## ADR-022: KVA import scope and Talousarvio tab

**Date:** 2026-02-12
**Decision:** Talousarvio tab shows only historical actuals imported from KVA Excel (3 earliest grey years from sheet "KVA totalt"). Import includes bucket totals and breakdown per year (Tulot, Kulut, Poistot, Investoinnit); "Förändring i..." and result rows are not imported; Tulos is always derived. Tuloajurit and computed revenue row are removed/disabled on Talousarvio (they belong to Forecast/Ennuste, out of scope). Confirm creates one budget per extracted year; single-year Vuosi selector is removed from import modal.
**Context:** Customer re-plan after previous sprint did not deliver correct Talousarvio behavior.
**Consequences:** KVA parser, preview UX, confirm API, and BudgetPage must align with this scope; regression coverage for sign/type and E2E verification in S-05.

Source: KVA Talousarvio re-plan (2026-02-12), `docs/SPRINT.md`

---

## ADR-023: Talousarvio 3-year-card UX and KVA import (locked decisions)

**Date:** 2026-02-12
**Decision:** (1) **Grouping:** Explicit DB grouping — add `importBatchId` (or equivalent); migration; KVA confirm sets same batch on all 3 budgets; Talousarvio selector chooses a "set"; page shows 3 year cards. (2) **Card header:** "Vuosi YYYY" + Tulos in header (green/red). (3) **Lägg till rad:** Remove "+ Lägg till rad" for valisummat-only view; history read-only. (4) **Confirm button:** FI "Tallenna", SWE "Spara", ENG "Save"; i18n per language. (5) **Källa:** Show "Källa: Importerad från Excel (filnamn + datum)" per year card; store importSourceFileName and importedAt. (6) **Investoinnit:** Always show bucket; 0 if empty.
**Context:** Customer locked Talousarvio tab plan (Swedish spec); sprint S-01..S-05 implements this.
**Consequences:** Schema migration for batch + Källa; API for sets and budgets-by-batch; BudgetPage 3 cards + 4 buckets + per-bucket expand; KVA modal year selector when >3 years, preview per-bucket expand, collapsible Diagnostiikka, confirm i18n.

Source: Talousarvio locked-in plan (2026-02-12), `docs/SPRINT.md`

---

## ADR-024: Talousarvio import single-source KVA totalt

**Date:** 2026-02-12
**Decision:** For Talousarvio KVA import, extract subtotal lines only from the sheet **KVA totalt**. Do not include Vatten KVA or Avlopp KVA in the subtotal extraction. One row per (categoryKey, year) in preview and in persisted data; no duplicate underrows from multiple sheets. Layout of the KVA totalt tab is documented during implementation via the existing inspect script; no separate customer paste required.
**Context:** User reported double-imported underrows (same category label twice) because extraction iterated KVA totalt, Vatten KVA, and Avlopp KVA. Locked plan: single source of truth so calculations match the Excel exactly.
**Consequences:** `extractSubtotalLines` sheetTargets restricted to KVA totalt only; tests and fixture expectations updated; docs/KVA_IMPORT_LOCKDOWN.md created. No per-service (vesi/jatevesi) rows in this import path.

Source: KVA import lockdown plan (2026-02-12), `docs/SPRINT.md`, plan file kva_import_lockdown_and_ui

---

## ADR-025: OS command router adds RUNSPRINT as explicit whole-sprint entry

**Date:** 2026-03-09
**Decision:** The repository OS router matches four exact command prefixes on the first user line: `PLAN`, `DO`, `RUNSPRINT`, `REVIEW`.
**Context:** Continuous `DO -> REVIEW` looping already exists, but users requested an explicit command name that means "run the active sprint from the current starting point through completion unless blocked" without changing `DO`.
**Consequences:**
- `RUNSPRINT` is a clearer whole-sprint execution entry for users.
- `DO` remains valid and unchanged.
- ADR-019 is superseded where it claimed the router matched only three exact command prefixes.

Source: OS hardening plan pass (2026-03-09), `AGENTS.md`, `docs/CANONICAL_REPORT.md`

---

## ADR-026: Protocol clean-tree checks use `git status --porcelain`

**Date:** 2026-03-09
**Decision:** Protocol clean-tree checks are defined by `git status --porcelain`. Ignored local files are outside protocol scope and do not block PLAN/DO/REVIEW completion. Tracked changes and untracked non-ignored files still count as dirty.
**Context:** The repository already used `git status --porcelain` for clean-tree enforcement, but the contract text did not explicitly state that ignored local scratch files were out of scope, which created avoidable confusion around local planning notes and other ignored artifacts.
**Consequences:**
- Local gitignored scratch files can exist without blocking protocol runs.
- Tracked edits such as `.gitignore` changes still block `DO` until committed or reverted.
- Review and execution behavior remain strict for meaningful working-tree dirtiness.

Source: OS hardening plan pass (2026-03-09), `AGENTS.md`, `docs/CANONICAL_REPORT.md`

---

## ADR-027: DO may edit sprint-scoped non-canonical product docs and config examples

**Date:** 2026-03-10
**Decision:** During DO, any product-scope file explicitly listed in the selected sprint substep `files:` scope may be edited, including non-canonical repo docs, config files, and env examples. Canonical planning docs (`docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`, `docs/CANONICAL*.md`, `docs/DECISIONS.md`) and `AGENTS.md` remain forbidden in DO.
**Context:** `S-32` legitimately required `README.md`, `DEPLOYMENT.md`, and `.env.example` changes to align demo-mode truth, but the earlier DO wording described product writes as code-only, which created an avoidable protocol blocker even though those files are supporting, non-canonical product docs.
**Consequences:**
- Sprint authors can list non-canonical docs/config examples directly in a substep `files:` scope when they are part of the implementation.
- DO remains tightly scoped to the selected substep; it does not gain blanket permission to edit planning docs.
- Canonical planning governance stays separated from product implementation.

Source: OS hardening plan pass (2026-03-10), `AGENTS.md`, `docs/CANONICAL.md`, `docs/CANONICAL_REPORT.md`

---

## ADR-028: The first authenticated V2 window is a six-step setup wizard

**Date:** 2026-03-11
**Decision:** Replace the current Overview landing/dashboard surface with a six-step guided setup wizard. The wizard shows `Vaihe X / 6`, keeps a compact setup summary visible, formats the org chip as imported company name plus short workspace hash, exposes one primary CTA per step, and keeps Ennuste locked until the final handoff step. User-facing setup terms use `suunnittelupohja` and `Pois suunnitelmasta`; `sync ready years` and `delete year` are removed from the first-window setup flow.
**Context:** Current code mixes import wizard panels, readiness cards, next-step CTA logic, trend cards/chart, peer snapshot, admin ops telemetry, and detailed year-comparison workspace on one landing surface. Customer direction is explicit: the first window should take the user from confusion to a ready planning baseline with one question at a time and no destructive wording.
**Consequences:**
- Setup flow now requires a wizard-first shell and locked navigation model in the web app.
- The current backend `syncImport` contract must be split or wrapped so year import and planning-baseline creation are separate user actions.
- The current destructive year-delete path cannot stay behind `Pois suunnitelmasta`; exclusion must become non-destructive or be clearly separated from delete semantics.

Source: customer wizard brief and planning session (2026-03-11), `docs/client/*`, `apps/web/src/v2/OverviewPageV2.tsx`, `apps/web/src/v2/AppShellV2.tsx`, `apps/api/src/v2/v2.service.ts`

---

## ADR-029: Wizard import state distinguishes available VEETI years from workspace-imported years

**Date:** 2026-03-12
**Decision:** In the setup wizard, connecting an organization exposes only the available VEETI years. Step 2 creates and persists a separate `workspaceYears` selection. Wizard summaries, review/fix flows, step progression, and planning-baseline creation must derive from persisted `workspaceYears`, not from all available VEETI years.
**Context:** Live audit showed that connecting Kronoby immediately displayed 7 imported years and jumped to step 4 because the UI treated `importStatus.years` as imported workspace data even though the backend contract currently uses that field for available/effective VEETI years.
**Consequences:**
- Backend/API need a separate persisted workspace-year contract or equivalent durable storage.
- Connect/search become discovery only; import remains an explicit step-2 action.
- Step 3 becomes reachable and stable across reload instead of being skipped by raw availability data.

Source: live audit and code review (2026-03-12), `apps/api/src/v2/v2.service.ts`, `apps/web/src/v2/OverviewPageV2.tsx`, `apps/web/src/v2/overviewWorkflow.ts`

---

## ADR-030: PLAN may use research subagents and DO/RUNSPRINT may use one implementation subagent per selected substep

**Date:** 2026-03-12
**Decision:** The repository OS allows bounded subagent delegation. PLAN may use read-only research subagents for follow-up context gathering only after the parent agent completes the required canonical reads in order. DO and RUNSPRINT may use one implementation subagent for the currently selected substep only. In all cases, the parent agent remains responsible for protocol compliance, scope control, command verification, commit creation, evidence/worklog updates, and clean-tree validation.
**Context:** The user requested explicit support for explorer-style context gathering during planning and worker-style execution help during DO/RUNSPRINT, but the existing contract did not define ownership boundaries for commits, evidence, or deterministic substep selection.
**Consequences:**
- Planning can gather focused context faster without weakening canonical-read order.
- DO/RUNSPRINT can offload implementation detail within one selected substep without parallelizing multiple sprint rows or substeps.
- Subagents do not own protocol docs or protocol commits; the parent agent stays accountable for the run.

Source: planning session (2026-03-12), `AGENTS.md`, `docs/CANONICAL_REPORT.md`

---

## ADR-031: DO may absorb in-scope dirty baseline and use bounded same-package gate fixes

**Date:** 2026-03-14
**Decision:** During DO/RUNSPRINT, pre-existing tracked or untracked non-ignored dirt does not block start if every dirty path already matches the selected substep `files:` scope and can be safely explained as part of that substep. Those in-scope paths may be absorbed into the product commit. If a required `run:` command fails, DO may edit the minimal additional files in the same workspace package needed to make that required verification pass. Cross-package fallout remains blocked. DO and REVIEW still must end with `git status --porcelain` empty. Sprint authoring must include likely same-package implementation or consumer files whenever a substep tightens a new test, parity, lint, typecheck, schema, or contract gate.
**Context:** Sprint execution on `S-43` and `S-46` repeatedly stopped on protocol blockers that were real under the old wording but too eager in practice: in-scope pre-existing dirt, same-package gate failures outside listed `files:`, and parity/test-tightening substeps that listed only the new gate file.
**Consequences:**
- DO stays strict at the end of each run, but no longer stops early on auditable in-scope baseline dirt.
- Same-package verification fallout can be fixed immediately when it is the minimal path to satisfy the required `run:` command.
- Sprint authors must write more realistic `files:` scopes for gate-tightening work.
- Evidence and worklog entries now distinguish `HARD BLOCKED` from `GATE BLOCKED`.

Source: blocker-policy hardening pass (2026-03-14), `AGENTS.md`, `docs/SPRINT.md`, `docs/CANONICAL_REPORT.md`

---

## ADR-032: Wizard UX truth prioritizes the active task over summary chrome

**Date:** 2026-03-15
**Decision:** In the setup wizard, the active step surface must be the first visible actionable content, and shell/sidebar chrome must stay secondary. Human-facing summary counts and readiness copy must describe imported workspace years only, not all available VEETI years. Direct route entry, tab locking, and post-clear state must reflect setup truth even before Overview emits child-owned callbacks.
**Context:** A full live UX audit after `S-43..S-47` showed that the product is functionally complete but still hard to read as a human flow: step-1/step-2 forms sit below non-actionable hero chrome, the shell can look more connected than the wizard state, and summary counts mix available and imported years.
**Consequences:**
- Step 1 and step 2 will be restructured so the form and primary CTA appear above summary chrome.
- The shell will become truthful on direct `/forecast` and `/reports` loads and after clear/reset.
- Step-2 import copy and list membership will be split into importable versus repair-only years.
- Forecast/Reports handoff must feel like continuation, not a second onboarding phase.

Source: UX audit and planning pass (2026-03-15), `apps/web/src/v2/AppShellV2.tsx`, `apps/web/src/v2/OverviewPageV2.tsx`, `apps/web/src/v2/EnnustePageV2.tsx`, `apps/web/src/v2/ReportsPageV2.tsx`

---

## ADR-033: Forecast pivots to a power-user resultatrakning cockpit with scenario-specific depreciation

**Date:** 2026-03-15
**Decision:** After setup is complete, `Ennuste` becomes a power-user workbench organized around five planning pillars: `Intakter`, `Materialkostnader`, `Personalkostnader`, `Ovriga rorelsekostnader`, and `Avskrivningar`. `Avskrivningar` must stay inside Forecast, not the setup wizard. Depreciation is scenario-specific, supports `straight-line` and `custom annual schedule`, maps one investment to exactly one depreciation category in the first implementation pass, and must show both `Basavskrivningar` and `Nya investeringars avskrivningar`.
**Context:** Customer guidance is explicit that the statement structure is the key planning frame. The client requirements say the three latest annual result statements form the base, and that depreciation should be calculated separately from the freshest booked year plus a 20-year investment plan and depreciation rules. Current code already has scenario lifecycle, fee-sufficiency metrics, org-level depreciation rules, and scenario-year allocations, but the IA is still form-first and the depreciation contract is not yet scenario-scoped.
**Consequences:**
- The next execution queue must reframe Forecast around statement rows rather than around generic form sections.
- The current organization-level depreciation-rule model must be migrated or wrapped into a scenario-specific contract.
- Report readiness and comparison views must be anchored to the five planning pillars and the resulting statement rows.

Source: customer direction (2026-03-15), [Bokslut reviderad 2024 (1).pdf](/C:/Users/john/Downloads/Bokslut%20reviderad%202024%20(1).pdf), `docs/client/Spec för uppgörande av en egendomsförvaltningsplan för 20 år.docx`, `docs/client/Investeringsplan PTS.xlsx`, `apps/web/src/v2/EnnustePageV2.tsx`, `apps/api/src/v2/v2.service.ts`
---

## ADR-034: Wizard year cards must show raw accounting structure, not inferred correctness

**Date:** 2026-03-16
**Decision:** In the setup wizard, VEETI completeness is only technical importability, not readiness. Import/review year cards must foreground the accounting rows that matter for the customer’s planning model, and support human validation by showing raw amounts rather than inferred badges or “obviously OK” summaries.
**Context:** Customer clarified that the most important rows for `Ennuste` are `Intakter`, `Materialkostnader`, `Personalkostnader`, and `Ovriga rorelsekostnader`, and that a small Finnish water company user validates a year by checking whether income roughly matches expenses and the year result, not by trusting a VEETI-complete badge.
**Consequences:**
- Step-2 and step-3 year cards should move closer to a compact resultatrakning view.
- The UI should show visible income/cost/result structure instead of interpretive badges.
- Labels like `Valmis` must not be used when the system only knows the VEETI data is technically present.

Source: customer direction (planning session 2026-03-16), `docs/client/Spec för uppgörande av en egendomsförvaltningsplan för 20 år.docx`, `apps/web/src/v2/OverviewPageV2.tsx`, `apps/api/src/veeti/veeti-budget-generator.ts`

---

## ADR-035: The active M0 execution target is a full frontend overhaul across wizard, statement correction, Forecast, and Reports

**Date:** 2026-03-16
**Decision:** Replace the narrow wizard-card alignment execution target with a comprehensive frontend-overhaul queue that covers: truthful shared shell state, trust-first year intake, explicit full manual override, first-class statement-PDF correction, strict planning-baseline gating before Forecast/Reports unlock, CFO-first Forecast landing with analyst drill-down mode, progressive investment planning, integrated depreciation strategy, provenance-consistent Reports, and final live proof using a real customer statement PDF.
**Context:** The customer requirement doc says the last three real result statements form the baseline, yearly development can be adjusted over 20 years, and future investments plus depreciation rules must drive the long-range planning model. The live audit with the real 2024 customer statement PDF proved the current UI can correct a year in-browser, but also proved the path is too hidden and the product still has mixed-language, trust, hierarchy, and workflow gaps.
**Consequences:**
- `docs/SPRINT.md` must execute a new comprehensive queue (`S-74..S-85`) instead of another narrow wizard-only follow-up.
- Wizard, Forecast, and Reports must now be planned and implemented as one continuous customer workflow.
- Final acceptance requires a real-PDF correction re-audit and no obvious trust, hierarchy, statement-import, or depreciation-planning blockers remaining in the audited paths.

Source: planning session 2026-03-16, `docs/client/Spec för uppgörande av en egendomsförvaltningsplan för 20 år.docx`, `docs/client/Investeringsplan PTS.xlsx`, `C:\Users\john\Downloads\Bokslut reviderad 2024 (1).pdf`, `docs/WIZARD_ACCOUNTING_CARD_REAUDIT.md`, `docs/UI_OVERHAUL_CANONICAL_PLAN.md`

---

## ADR-036: `Yhteenveto` year cards use the 5 canon line items plus `Tulos`, with direct `AineetJaPalvelut` and inline card editing

**Date:** 2026-03-17
**Decision:** For the `Yhteenveto` step-2 and step-3 year cards, the visible accounting stack must be: `Tuotot`, `Aineet ja palvelut`, `Henkil�st�kulut`, `Poistot`, `Muut toimintakulut`, and `Tulos`, with `Tulos` as the bottom and visually strongest row. Use VEETI `AineetJaPalvelut` directly when it exists and remove the fallback split that invents materials/services from `LiiketoiminnanMuutKulut`. The card itself becomes the normal editing surface through inline whole-card edit mode. Secondary main stats (water price, wastewater price, sold water volume, sold wastewater volume) stay visible lower on the card. Literal missing/source wording replaces vague trust jargon. Subrows may expand only if real source data exists; otherwise the card stays summary-level.
**Context:** The customer explicitly clarified that the current `Yhteenveto` year cards still are not good enough even after the broader frontend-overhaul queue. The customer wants the same accounting line items that matter in `Ennuste`, wants `Tulos` to visually dominate because it is the fastest sanity check, rejects vague wording like `Varanollia k�yt�ss�`, and wants normal correction to happen on the card itself rather than in some separate modal flow.
**Consequences:**
- The next active sprint queue must focus only on `Yhteenveto` card perfection rather than broader Forecast work.
- Current fallback-split logic for materials/services must be removed from the card contract.
- Step 2 and step 3 must converge on the same card model and editing surface.
- Final acceptance requires a live `Yhteenveto` audit, including the real 2024 statement-PDF correction path and an explicit answer on truthful subrow availability.

Source: planning session 2026-03-17, `docs/client/Spec för uppgörande av en egendomsförvaltningsplan för 20 år.docx`, `C:\Users\john\Downloads\Bokslut reviderad 2024 (1).pdf`, `docs/tmp_YHTEENVETO_PERFECTION_PLAN.md`
---

## ADR-037: Sprint execution uses blast-radius scopes, row-level docs commits, and explicit helper-model routing

**Date:** 2026-03-18
**Decision:** The repository OS now treats sprint `files:` scopes as blast-radius contracts rather than precise edit inventories. DO packets are sized by coherent verification and scope boundaries instead of an arbitrary substep cap, predictable same-area collateral files are implicitly allowed, and DO may widen the active row scope once when minimal same-area support files were omitted. Successful packets still require a `do(S-XX)` commit, but a separate `docs(S-XX)` commit is now required only when a row reaches `READY`, when DO stops on a blocker, or when docs-only follow-up must land after the packet commit. `RUNSPRINT` explicitly means continuing until every active row has all substeps completed, reaches `READY`, passes the row-gated REVIEW, and ends `DONE`, unless blocked. When model controls are available, parent-led big reads and big work prefer `gpt-5.4` with `high`, while `worker` and `explorer` helpers prefer `gpt-5.4-mini` with `high`.
**Context:** The prior contract stayed strict in useful ways, but it was too brittle in two operational areas: exact up-front file prediction and docs-commit cadence. That combination caused avoidable `files:` blockers, especially for auth, tests, config, and browser automation work, while also slowing `RUNSPRINT` with extra docs commits after every small packet. The model-routing guidance also needed to match the new preferred split between parent-led heavy work and lighter helper execution.
**Consequences:**
- Sprint authors should write `files:` scopes as realistic area boundaries and stop pretending cross-cutting work can be modeled as one tiny exact-file list.
- Predictable collateral such as lockfiles, same-workspace test harness config, and directly coupled auth/session support files no longer trigger fake blockers by default.
- Packet progress may be persisted in the packet commit while the row remains `IN_PROGRESS`, reducing commit overhead without relaxing clean-tree or evidence requirements.
- `RUNSPRINT` is now explicitly whole-sprint completion behavior, not a single-row or single-READY pass.
- Native helper use stays bounded, but helper model routing is now explicit: `gpt-5.4-mini` for `worker` and `explorer`, `gpt-5.4` with `high` for parent-led heavy reads/works and any broader synthesis helper that truly needs it.

Source: OS hardening pass (2026-03-18), `AGENTS.md`, `docs/CANONICAL.md`, `docs/SPRINT.md`