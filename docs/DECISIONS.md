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
