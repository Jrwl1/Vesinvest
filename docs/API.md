# API Reference

Base URL: `http://localhost:3000` (dev) or your Railway deployment URL.

## Authentication

All endpoints except those marked **(public)** require `Authorization: Bearer <JWT>` header. The `TenantGuard` extracts `org_id` from the JWT and scopes all queries.

### Error format

```json
{
  "statusCode": 404,
  "message": "Budget not found",
  "error": "Not Found"
}
```

Prisma errors return 503 (connection) or 500 (other). Validation errors return 400 with field-level details.

---

## Health **(public)**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health/live` | Liveness check (no DB) |
| `GET` | `/health` | Readiness check (DB ping) |
| `GET` | `/health/config` | Runtime config info (demo mode, version) |

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/login` | No | Email/password login. Body: `{ email, password, orgId }`. Returns `{ access_token }`. |
| `POST` | `/auth/demo-login` | No | Demo login (only when demo enabled). Returns `{ access_token }`. |
| `POST` | `/auth/dev-token` | No | Dev-only bypass token. Returns `{ access_token }`. |
| `POST` | `/auth/me` | JWT | Returns current user info. |

## Demo **(public)**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/demo/status` | Reports `{ enabled, orgId }` or `{ enabled: false }`. |
| `POST` | `/demo/seed` | Seeds optional demo dataset (budget, assumptions, projection). Idempotent; returns `{ alreadySeeded, seededAt, created? }`. **Only when demo mode enabled; 404 in production.** |
| `POST` | `/demo/reset` | Wipes and re-seeds demo data. Returns reset summary. |

---

## Budgets (VA Finance)

All routes require JWT + TenantGuard.

### Budget CRUD

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/budgets` | List budgets for current org. |
| `POST` | `/budgets` | Create budget. Body: `{ vuosi, nimi? }`. |
| `GET` | `/budgets/:id` | Get budget with lines (`rivit`) and drivers (`tuloajurit`). |
| `PATCH` | `/budgets/:id` | Update budget. Body: `{ nimi?, tila? }`. |
| `DELETE` | `/budgets/:id` | Delete budget. |

### Budget Lines

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/budgets/:id/rivit` | Create budget line. Body: `{ tiliryhma, nimi, tyyppi, summa }`. |
| `PATCH` | `/budgets/:id/rivit/:riviId` | Update budget line. |
| `DELETE` | `/budgets/:id/rivit/:riviId` | Delete budget line. |

### Revenue Drivers

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/budgets/:id/tuloajurit` | Create revenue driver. Body: `{ palvelutyyppi, yksikkohinta, myytyMaara, ... }`. |
| `PATCH` | `/budgets/:id/tuloajurit/:ajuriId` | Update revenue driver. |
| `DELETE` | `/budgets/:id/tuloajurit/:ajuriId` | Delete revenue driver. |

### Budget Import

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/budgets/:id/import/preview` | Upload CSV/Excel, get parsed preview. `multipart/form-data`, field: `file`. Max 5MB. |
| `POST` | `/budgets/:id/import/confirm` | Confirm import with selected rows. Body: `{ rows: [...] }`. |

## Assumptions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/assumptions` | List org assumptions. |
| `PUT` | `/assumptions/:avain` | Upsert assumption by key. Body: `{ arvo, nimi?, yksikko?, kuvaus? }`. |
| `POST` | `/assumptions/reset-defaults` | Reset all assumptions to defaults. |

**Default assumption keys:** `inflaatio`, `energiakerroin`, `vesimaaran_muutos`, `hintakorotus`, `investointikerroin`

## Projections

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projections` | List projections. |
| `POST` | `/projections` | Create projection. Body: `{ talousarvioId, nimi, aikajaksoVuosia? }`. |
| `GET` | `/projections/:id` | Get projection with computed years (`vuodet`). |
| `PATCH` | `/projections/:id` | Update projection. Body: `{ nimi?, aikajaksoVuosia?, olettamusYlikirjoitukset?, onOletus? }`. |
| `DELETE` | `/projections/:id` | Delete projection. |
| `POST` | `/projections/:id/compute` | Run projection engine. Returns updated projection with `vuodet`. |
| `POST` | `/projections/compute-for-budget` | Upsert + compute for a budget. Body: `{ talousarvioId, olettamusYlikirjoitukset? }`. |
| `GET` | `/projections/:id/export` | Download CSV export of projection years. |

---

## Legacy Endpoints

These endpoints are from the asset management era. They are still routed but the UI has pivoted away.

### Assets

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/assets` | List assets (filterable). |
| `POST` | `/assets` | Create asset. |
| `GET` | `/assets/:id` | Get asset by ID. |
| `GET` | `/assets/by-ref/:externalRef` | Get asset by external reference. |
| `PATCH` | `/assets/:id` | Update asset. |
| `PATCH` | `/assets/:id/replace-identity` | Replace asset external reference. |
| `GET` | `/assets/missing-details-count` | Count assets with incomplete data. |

### Sites

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sites` | List sites. |
| `POST` | `/sites` | Create site. |
| `PATCH` | `/sites/:id` | Update site. |

### Asset Types

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/asset-types` | List asset types. |
| `POST` | `/asset-types` | Create asset type. |
| `PATCH` | `/asset-types/:id` | Update asset type. |

### Excel Imports

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/imports` | List imports. |
| `POST` | `/imports/upload` | Upload Excel file. `multipart/form-data`. Max 10MB. |
| `GET` | `/imports/:id` | Get import details. |
| `DELETE` | `/imports/:id` | Delete import. |
| `GET` | `/imports/:id/inbox` | Get import inbox. |
| `GET` | `/imports/:id/sheets/:sheetId/preview` | Sheet preview with column profiles. |
| `GET` | `/imports/:id/sheets/:sheetId/suggestions` | Column mapping suggestions. |
| `GET` | `/imports/:id/sheets/:sheetId/auto-extract-analysis` | Auto-extract analysis. |
| `POST` | `/imports/:id/auto-extract` | Execute auto-extract. |
| `POST` | `/imports/:id/execute` | Execute full import. |
| `POST` | `/imports/:id/preview` | Dry-run import preview. |
| `POST` | `/imports/:id/validation-report` | Generate validation report. |
| `POST` | `/imports/:id/readiness-check` | Pre-import readiness check. |
| `GET` | `/imports/:id/sanity-summary` | Post-import sanity summary. |

### Mappings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mappings` | List mappings. |
| `POST` | `/mappings` | Create mapping. |
| `GET` | `/mappings/:id` | Get mapping. |
| `PATCH` | `/mappings/:id` | Update mapping. |
| `DELETE` | `/mappings/:id` | Delete mapping. |
| `POST` | `/mappings/:id/validate` | Validate mapping. |
| `GET` | `/mappings/canonical-fields` | List canonical field registry. |
| `GET` | `/mappings/templates/match` | Find matching templates. |
| `GET` | `/mappings/templates/list` | List templates. |

### Maintenance

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/maintenance/maintenance-items` | List maintenance items. |
| `POST` | `/maintenance/maintenance-items` | Create maintenance item. |
| `PATCH` | `/maintenance/maintenance-items/:id` | Update maintenance item. |
| `GET` | `/maintenance/plans/projection` | Maintenance cost projection. |

### Planning Scenarios

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/planning-scenarios` | List scenarios. |
| `POST` | `/planning-scenarios` | Create scenario. |
| `GET` | `/planning-scenarios/default` | Get default scenario. |
| `GET` | `/planning-scenarios/:id` | Get scenario. |
| `PATCH` | `/planning-scenarios/:id` | Update scenario. |
| `DELETE` | `/planning-scenarios/:id` | Delete scenario. |

---

**Note:** No OpenAPI/Swagger spec is generated. See [TASKS.md](TASKS.md) item #6 for adding `@nestjs/swagger`.

Source: `apps/api/src/*/\*.controller.ts`
