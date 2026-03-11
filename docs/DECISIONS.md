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
