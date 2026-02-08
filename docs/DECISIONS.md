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
