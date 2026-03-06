# Architecture

## Overview

Vesipolku is a multi-tenant SaaS for Finnish water utility financial planning. The active product is a V2 workflow built around trusted effective year data:

1. Import and review years in Overview
2. Build scenarios in Forecast
3. Generate outputs in Reports

VEETI is the default seed and benchmarking source, but forecast and reports should rely on effective year data after manual correction when historical VEETI values are incomplete or wrong.

```
┌────────────────────────────────────────────────────┐
│                 React + Vite (web)                  │
│  OverviewPageV2  EnnustePageV2  ReportsPageV2      │
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
│  │ V2       │ │ VEETI    │ │ Projections  │       │
│  │ Overview │ │ Sync +   │ │ + Engine     │       │
│  │ + Flow   │ │ Trust    │ │ + Export     │       │
│  └──────────┘ └──────────┘ └──────────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐       │
│  │ Budgets  │ │Assumptions│ │ Reports      │       │
│  │ + Lines  │ │          │ │ + Snapshots  │       │
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
| **V2**          | `apps/api/src/v2/`          | Overview, import governance, forecast/report orchestration, scenario lifecycle, report creation, trust-oriented API surface.                                                   |
| **VEETI**       | `apps/api/src/veeti/`       | VEETI org search, sync, snapshots, overrides, year policies, effective rows, trust-state evaluation, benchmarking inputs.                                                     |
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

### Legacy / secondary

| Module                 | Path                               | Responsibility                                                                      |
| ---------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| **Assets**             | `apps/api/src/assets/`             | Asset CRUD, identity contract, derived fields.                                      |
| **Sites**              | `apps/api/src/sites/`              | Location/site CRUD.                                                                 |
| **Imports**            | `apps/api/src/imports/`            | Excel upload, sheet parsing, column profiling, auto-extract, validation, execution. |
| **Mappings**           | `apps/api/src/mappings/`           | Column mapping templates, canonical field registry, suggestions.                    |
| **Maintenance**        | `apps/api/src/maintenance/`        | Maintenance items, cost projection.                                                 |
| **Planning Scenarios** | `apps/api/src/planning-scenarios/` | Legacy planning scenario CRUD.                                                      |

## Data flow

### Overview -> Forecast -> Reports

```
User opens Overview (V2)
  → connect org to VEETI
  → import candidate years
  → review per-year trust state
  → keep VEETI or apply manual effective values
  → sync trusted years into baseline budgets

User opens Forecast (Ennuste V2)
  → create scenario from trusted baseline
  → edit assumptions and investments
  → compute scenario with ProjectionEngine
  → store year-by-year outputs

User opens Reports (V2)
  → create report from computed scenario
  → review report snapshot
  → download PDF artifact
```

### Effective year data flow

```
VEETI snapshot rows
  + optional manual overrides
  + optional year policy exclusions
  → VeetiEffectiveDataService
  → source status per year:
      VEETI | MANUAL | MIXED | INCOMPLETE
  → effective rows for each dataset
  → trusted baseline budget generation
  → forecast scenarios and reports
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
| `VeetiSnapshot`   | VEETI snapshot| Raw VEETI data per org/year/type    |
| `VeetiOverride`   | Ylikirjoitus | Manual effective-value overrides    |
| `VeetiYearPolicy` | Vuosipolitiikka | Year exclusion / restore policy  |
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
- **VEETI is a first-party product dependency.** Core V2 import and benchmarking flows depend on VEETI data access and local snapshot storage.
- **MinIO** is provisioned in docker-compose but is not part of the current effective-year workflow.
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
5. **Effective year trust is server-side.** Source status, effective rows, exclusions, and baseline generation must be computed on the API.
6. **All hooks before all returns.** React components must declare all hooks (useState, useEffect, useCallback, etc.) before any conditional `return` statement.
7. **Translation keys, not hardcoded strings.** All user-facing text goes through `react-i18next` with keys in `fi.json`, `sv.json`, `en.json`.

Source: `apps/api/src/demo/demo.constants.ts`, `apps/api/src/tenant/tenant.guard.ts`, `apps/web/src/App.tsx`
