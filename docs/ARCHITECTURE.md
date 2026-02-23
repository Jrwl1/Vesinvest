# Architecture

## Overview

Vesipolku is a multi-tenant SaaS for Finnish water utility financial planning. The system is a pnpm monorepo with two apps and two shared packages.

```
┌────────────────────────────────────────────────────┐
│                 React + Vite (web)                  │
│   BudgetPage  RevenuePage  ProjectionPage  Settings│
│              ┌──────────┐                          │
│              │  api.ts   │ (fetch-based client)    │
│              └─────┬─────┘                         │
└────────────────────┼───────────────────────────────┘
                     │ HTTPS (JWT Bearer)
┌────────────────────┼───────────────────────────────┐
│                NestJS API                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐       │
│  │  Auth    │ │ Tenant   │ │ Health       │       │
│  │ (JWT +   │ │ Guard    │ │ /live /ready │       │
│  │  demo)   │ │ (orgId)  │ │ /config      │       │
│  └──────────┘ └──────────┘ └──────────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐       │
│  │ Budgets  │ │Assumptions│ │ Projections  │       │
│  │ + Lines  │ │          │ │ + Engine     │       │
│  │ + Drivers│ │          │ │ + Export     │       │
│  └──────────┘ └──────────┘ └──────────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐       │
│  │ Assets   │ │ Imports  │ │ Mappings     │  (L)  │
│  │ (Legacy) │ │ (Legacy) │ │ (Legacy)     │       │
│  └──────────┘ └──────────┘ └──────────────┘       │
│                    │                               │
│              ┌─────┴─────┐                         │
│              │  Prisma   │                         │
│              └─────┬─────┘                         │
└────────────────────┼───────────────────────────────┘
                     │
              ┌──────┴──────┐
              │ PostgreSQL  │
              │   16        │
              └─────────────┘
```

**(L)** = Legacy modules from the asset-management era; still compiled and routed but the UI pivot targets Vesipolku budgeting features.

## Modules and responsibilities

### Core (Vesipolku)

| Module          | Path                        | Responsibility                                                                                                                                                                  |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Budgets**     | `apps/api/src/budgets/`     | CRUD for `Talousarvio`, budget lines (`TalousarvioRivi`), revenue drivers (`Tuloajuri`), CSV/Excel import.                                                                      |
| **Assumptions** | `apps/api/src/assumptions/` | Org-level financial assumptions (`Olettamus`): inflation, energy factor, volume change, price increase, investment factor.                                                      |
| **Projections** | `apps/api/src/projections/` | Multi-year projection engine (`Ennuste` + `EnnusteVuosi`). Computes year-by-year revenue, expenses, investments, net result, cumulative result. Supports scenarios. CSV export. |
| **Demo**        | `apps/api/src/demo/`        | Bootstrap/reset demo data. Seeds org, user, budget, assumptions, projection.                                                                                                    |

### Infrastructure

| Module     | Path                   | Responsibility                                                                          |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------- |
| **Auth**   | `apps/api/src/auth/`   | JWT strategy (Passport), login, demo login, dev token.                                  |
| **Tenant** | `apps/api/src/tenant/` | `TenantGuard` — extracts `orgId` from JWT, sets `req.orgId`. Global module.             |
| **Prisma** | `apps/api/src/prisma/` | `PrismaService` (connection, retry, health), `PrismaExceptionFilter`. Global module.    |
| **Health** | `apps/api/src/health/` | `/health/live` (liveness), `/health` (readiness + DB), `/health/config` (runtime info). |

### Legacy

| Module                 | Path                               | Responsibility                                                                      |
| ---------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| **Assets**             | `apps/api/src/assets/`             | Asset CRUD, identity contract, derived fields.                                      |
| **Sites**              | `apps/api/src/sites/`              | Location/site CRUD.                                                                 |
| **Imports**            | `apps/api/src/imports/`            | Excel upload, sheet parsing, column profiling, auto-extract, validation, execution. |
| **Mappings**           | `apps/api/src/mappings/`           | Column mapping templates, canonical field registry, suggestions.                    |
| **Maintenance**        | `apps/api/src/maintenance/`        | Maintenance items, cost projection.                                                 |
| **Planning Scenarios** | `apps/api/src/planning-scenarios/` | Legacy planning scenario CRUD.                                                      |

## Data flow

### Budget → Projection

```
User sets revenue drivers (Tulot page)
  → Tuloajuri records (price, volume, base fee, connections)
  → computedRevenue shown in Talousarvio

User clicks "Laske ennuste" (Projection page)
  → POST /projections/:id/compute (or /projections/compute-for-budget)
  → ProjectionEngine.compute():
      For each year 1..N:
        revenue = base × (1 + priceIncrease)^year × (1 + volumeChange)^year
        expenses = base × (1 + inflation)^year × (energyFactor)
        investments = base × investmentFactor^year
        net = revenue - expenses - investments
        cumulative += net
  → EnnusteVuosi rows stored
  → Returned to frontend, rendered in year-by-year table
```

### Auth flow

```
Browser                         API
  │                              │
  ├─ GET /demo/status ──────────►│  (no auth)
  │◄──── { enabled: true } ─────┤
  │                              │
  ├─ POST /auth/demo-login ─────►│  (bootstraps demo org + user)
  │◄──── { access_token: JWT } ──┤
  │                              │
  │  (all subsequent requests)   │
  ├─ GET /budgets ──────────────►│
  │   Authorization: Bearer JWT  │
  │   → JwtAuthGuard validates   │
  │   → TenantGuard sets orgId   │
  │◄──── [Budget[]] ────────────┤
```

## Auth model

- **Strategy:** JWT via `passport-jwt`. Token in `Authorization: Bearer` header.
- **Guards:** `JwtAuthGuard` (validates JWT) + `TenantGuard` (extracts `org_id` from claims, sets `req.orgId`).
- **Demo mode:** `JwtAuthGuard` bypasses validation; `TenantGuard` injects `DEMO_ORG_ID`.
- **Token payload:** `{ sub, org_id, roles, iat, exp }`
- **Expiry:** 1h (normal), 24h (demo), 7d (dev token).
- **Secret:** `JWT_SECRET` env var; falls back to `'dev_secret'` in dev.

Source: `apps/api/src/auth/jwt.strategy.ts`, `apps/api/src/auth/jwt.guard.ts`, `apps/api/src/tenant/tenant.guard.ts`

## Persistence

- **Database:** PostgreSQL 16
- **ORM:** Prisma 5.22
- **Schema:** `apps/api/prisma/schema.prisma`
- **Migrations:** `apps/api/prisma/migrations/` (SQL, auto-generated by `prisma migrate dev`)
- **Seed:** `apps/api/prisma/seed.ts` (called by `prisma db seed`)

### Key models

| Prisma model      | Finnish name | Purpose                             |
| ----------------- | ------------ | ----------------------------------- |
| `Talousarvio`     | Talousarvio  | Budget (per org, per year)          |
| `TalousarvioRivi` | Rivi         | Budget line (kulu/tulo/investointi) |
| `Tuloajuri`       | Tuloajuri    | Revenue driver (price × volume)     |
| `Olettamus`       | Olettamus    | Financial assumption (key-value)    |
| `Ennuste`         | Ennuste      | Projection scenario                 |
| `EnnusteVuosi`    | Vuosi        | Computed yearly output              |
| `Organization`    | —            | Multi-tenant org                    |
| `User`            | —            | User account                        |

### Multi-tenancy

Every data-bearing table has an `orgId` column. `TenantGuard` ensures queries are always scoped. Services receive `orgId` as first parameter; repositories filter by it.

Source: `apps/api/src/tenant/tenant.guard.ts`

## Key runtime assumptions

- **No queues, cron, or caches.** All computation is synchronous request-response.
- **No third-party APIs** in the core flow. Excel parsing is local (ExcelJS).
- **MinIO** is provisioned in docker-compose but not currently used by the API (legacy placeholder for file storage).
- **Single-region.** No replication or multi-region considerations.

## Observability

- **Logging:** NestJS `Logger` + custom request logging middleware in `main.ts` (method, URL, status, duration).
- **Health checks:** `/health/live` (no DB), `/health` (with DB ping), `/health/config` (runtime info).
- **No metrics/tracing** infrastructure. CORS rejections are logged once per origin.

Source: `apps/api/src/main.ts`, `apps/api/src/health/health.controller.ts`

## Invariants

Rules that must not be broken:

1. **Org isolation is mandatory.** Every data query must be scoped by `orgId`. Never trust client-provided org IDs; always extract from JWT via `TenantGuard`.
2. **Demo mode is never enabled in production** (`isDemoModeEnabled()` returns `false` when `NODE_ENV=production`).
3. **Demo login is explicit.** The frontend never auto-calls `demoLogin()` on load; only on "Use Demo" button click.
4. **Finnish field names in Prisma** use ASCII-safe identifiers with `@map()` for database columns. Full Finnish terms appear only in i18n/UI.
5. **Budget computation is server-side only.** The `ProjectionEngine` runs on the API; the frontend displays results but never computes projections.
6. **All hooks before all returns.** React components must declare all hooks (useState, useEffect, useCallback, etc.) before any conditional `return` statement.
7. **Translation keys, not hardcoded strings.** All user-facing text goes through `react-i18next` with keys in `fi.json`, `sv.json`, `en.json`.

Source: `apps/api/src/demo/demo.constants.ts`, `apps/api/src/tenant/tenant.guard.ts`, `apps/web/src/App.tsx`
