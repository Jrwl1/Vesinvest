# Deployment Guide

## Current Production Path

Current VPS production deploys are documented in `docs/PROD_DEPLOY.md`.
Use that document for `vesipolku.jrwl.io` / `api.jrwl.io`.

The Railway and Vercel sections below are older deployment notes and not the current prod path.

This guide covers deploying the Vesipolku financial planning app to Railway (backend) and Vercel (frontend).

## Release gates (single-tenant)

Before releasing or deploying, run the following gates. If any command fails, do not release until the failure is resolved.

### Build gate command checklist

Run from the repository root:

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `pnpm build` | Build all packages and apps; must succeed before deploy |

**Evidence:** Record the last successful run (timestamp and commit hash). Re-run after any dependency or code change that could affect the build.

### Pre-release security checklist

Complete before each release. Required evidence fields: **commit hash**, **date**, **auth spec result**.

| Check | Command / action | Evidence field |
|-------|------------------|----------------|
| Auth controller tests pass | `pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts` | Paste test output (e.g. "X passed") |
| No secrets in env example | Confirm `apps/api/.env.example` has no real secrets | Noted in release notes |
| JWT_SECRET set in production | Verify deployment has `JWT_SECRET` (32+ chars) | Owner + timestamp |

**Evidence:** Run the auth spec and paste the result; record commit hash and date in the release gate log.

### Hosted single-tenant readiness checklist

Before going live for a tenant, complete this checklist. Required fields: **Owner**, **Timestamp**.

| Check | Owner | Timestamp | Notes |
|-------|-------|-----------|-------|
| App module / bootstrap tests pass | | | `pnpm --filter ./apps/api test -- test/app.module.spec.ts` |
| Database migrations applied | | | |
| `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` set in Railway | | | |
| Health check returns OK | | | `GET /health/live` |

**Evidence:** Run the app module spec; fill Owner and Timestamp when the checklist is completed for a release.

### Gate failure instructions

When a release gate fails or required evidence is missing:

1. **Do not release or deploy** until the failing gate passes and evidence is recorded.
2. **Build failed:** Fix the failing build (e.g. fix TypeScript/ESLint errors, restore missing deps); re-run `pnpm build` from repo root.
3. **Auth or app module tests failed:** Fix the failing tests or environment; re-run the relevant spec (see checklists above).
4. **Missing evidence:** Fill in commit hash, date, and test output for the pre-release and readiness checklists before marking the release approved.
5. **Unblocking:** If the failure is a known, accepted exception (e.g. skipped test), document it in the release notes and get explicit approval before proceeding.

### Release gate dry-run (example)

Run from the repository root before tagging a release. Artifact links: this document (§ Build gate, § Pre-release security checklist, § Hosted single-tenant readiness checklist).

```bash
pnpm build
pnpm lint
pnpm test
```

**Example dry-run summary (2026-02-11):**

| Command     | Result |
|------------|--------|
| `pnpm build` | OK — packages + apps built |
| `pnpm lint`  | May fail if ESLint config or plugins not installed in workspace |
| `pnpm test`  | OK — API 24 suites (276 passed, 1 skipped), web 3 files (8 passed) |

Record the actual output and commit hash when running a real gate dry-run; update this table or append to `docs/SPRINT.md` S-05 evidence.

## Prerequisites

- Railway account (https://railway.app)
- Vercel account (https://vercel.com)
- PostgreSQL database (Railway provides this)

---

## Backend Deployment (Railway)

### 1. Create Railway Project

```bash
# Install Railway CLI (optional, can also use web UI)
npm i -g @railway/cli
railway login
```

### 2. Create PostgreSQL Database

1. Go to Railway dashboard → New Project
2. Click "Add Service" → "Database" → "PostgreSQL"
3. Once created, copy the `DATABASE_URL` from the Variables tab

### 3. Deploy API

1. In the same project, click "Add Service" → "GitHub Repo"
2. Select your repository
3. Configure:
   - **Root Directory**: `/` (repo root - uses nixpacks.toml)
   - **Build Command**: (leave empty - nixpacks.toml handles it)
   - **Start Command**: (leave empty - nixpacks.toml handles it)

> **Note**: The repo includes `nixpacks.toml` which configures pnpm via Corepack automatically.

### 4. Set Environment Variables

In Railway dashboard → API service → Variables tab, add:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | (auto-linked from PostgreSQL) | ✓ |
| `JWT_SECRET` | Random 32+ char string | ✓ |
| `NODE_ENV` | `production` | ✓ |
| `CORS_ORIGINS` | Your Vercel URL (e.g., `https://your-app.vercel.app`) | ✓ |
| `TRUST_PROXY` | Trusted proxy hop count or label (for example `1`) | âœ“ |
| `AUTH_RATE_LIMIT_MODE` | `edge` | âœ“ |
| `AUTH_EDGE_RATE_LIMIT_SECRET` | Long random secret injected by the trusted edge | âœ“ |
| `PORT` | (auto-set by Railway) | - |

**Generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generate a secure auth edge secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4a. Auth throttling edge contract

Production auth throttling is no longer allowed to rely on the API's in-memory limiter alone.

Your trusted reverse proxy / edge must:

1. Apply rate limits to `POST /auth/login`, `POST /auth/demo-login`, and `POST /auth/invitations/accept`.
2. Strip any client-supplied `x-auth-rate-limit-verified` header.
3. Inject `x-auth-rate-limit-verified: $AUTH_EDGE_RATE_LIMIT_SECRET` when the request passed those edge rate limits.
4. Forward the real client IP through the trusted proxy chain that matches `TRUST_PROXY`.

If `NODE_ENV=production` and `AUTH_RATE_LIMIT_MODE=edge` is not configured correctly, the API bootstrap now fails closed.

### 5. Deploy

Railway will auto-deploy on push. For manual deploy:
```bash
railway up
```

### 6. Get API URL

Once deployed, Railway provides a URL like:
```
https://your-api-production.up.railway.app
```

### 7. Seed Database (Optional)

For demo data, run the seed script:
```bash
# Connect to Railway shell
railway run pnpm prisma:seed
```

---

## Frontend Deployment (Vercel)

### 1. Import Project

1. Go to Vercel dashboard → "Add New" → "Project"
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm install && pnpm build`
   - **Output Directory**: `dist`

> **Note**: The `apps/web/public/` directory must exist as a directory (not a file). Vite expects this for static assets. The repo includes a `.gitkeep` to ensure Git tracks the empty directory.

### 2. Set Environment Variables

In Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_API_BASE_URL` | Your Railway API URL (e.g., `https://your-api.up.railway.app`) | ✓ |

### 3. Deploy

Vercel will auto-deploy on push. For manual deploy:
```bash
vercel --prod
```

### 4. Get Frontend URL

Once deployed, Vercel provides a URL like:
```
https://your-app.vercel.app
```

### 5. Update CORS

Go back to Railway and update `CORS_ORIGINS` to include your Vercel URL.

---

## Post-Deployment

### Create Admin User

The seed script creates a demo user. For production, create users via Prisma Studio or a custom script:

```bash
# On Railway
railway run pnpm prisma studio
```

Or create via API:
```bash
# Replace with your values
curl -X POST https://your-api.up.railway.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"SecurePass123","orgId":"org-uuid"}'
```

### Verify Deployment

1. Open frontend URL
2. Login with seeded credentials:
   - Org ID: (from seed output)
   - Email: `admin@dev.local`
   - Password: `password123`

3. Test:
   - [ ] Assets page loads
   - [ ] Sites page loads
   - [ ] Projection page runs
   - [ ] Asset detail opens
   - [ ] Maintenance items create

---

## Demo Mode

**Behavior:**
- **Local / dev:** Non-production defaults to **trial mode**, not demo mode. The login page checks `GET /demo/status` and only shows **"Try Demo"** when the API reports `appMode=internal_demo`.
- **Demo login** creates an **empty org**. Users can then seed or reset the demo dataset through the dedicated demo endpoints. `POST /demo/seed` is only available when demo mode is enabled.
- **Production:** Demo is **off** unless you deliberately configure a dedicated demo instance. Never enable demo mode against real customer data.

**Env vars (API):**
- Preferred: `APP_MODE=internal_demo` enables demo login and demo reset/seed endpoints.
- Default when unset: `APP_MODE` resolves to `trial` in non-production and `production` in production.
- Legacy fallback: `DEMO_MODE=true` still enables internal demo mode when `APP_MODE` is unset.

**Start API in local trial mode (PowerShell):**
```powershell
cd apps/api
$env:NODE_ENV="development"; Remove-Item Env:APP_MODE -ErrorAction Ignore; Remove-Item Env:DEMO_MODE -ErrorAction Ignore; pnpm dev
```

**Start API with internal demo enabled (PowerShell):**
```powershell
$env:APP_MODE="internal_demo"; pnpm dev
```

**Legacy fallback (only if `APP_MODE` is unset):**
```powershell
$env:DEMO_MODE="true"; pnpm dev
```

### Demo Mode Checklist (public showcase on Railway)

To enable auto-login demo for a **deployed** showcase:

### Railway Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | (auto-linked) | PostgreSQL connection |
| `JWT_SECRET` | Random 32+ chars | Token signing |
| `NODE_ENV` | `production` | Production mode |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | **Must include Vercel domain exactly** |
| `DEMO_MODE` | `true` | Enables `GET /demo/status` and `POST /auth/demo-login` (only set for demo instances) |
| `DEMO_KEY` | Random secret string | Optional; shared secret for demo auth when set |

### Vercel Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_BASE_URL` | `https://your-api.up.railway.app` | API endpoint |
| `VITE_DEMO_KEY` | Same as Railway `DEMO_KEY` | Only if you set `DEMO_KEY` on the API |

> **Warning**: If you set `DEMO_KEY` on Railway, `VITE_DEMO_KEY` must match. The frontend learns demo availability from `GET /demo/status`; no need for `VITE_DEMO_MODE`.

> **Important**: Do not manually set `PORT` in Railway. Railway auto-injects `PORT` and routes traffic to it. The app listens on `process.env.PORT`.

### Verify Demo Works

1. **Check API health:**
   ```
   https://your-api.up.railway.app/health/live   → {"status":"ok"}
   https://your-api.up.railway.app/health        → {"status":"ok","db":"ok"}
   ```

2. **Open Vercel URL:**
   ```
   https://your-app.vercel.app
   ```
   Should show "Signing you in..." then auto-load Assets page.

3. **If login form appears instead:**
   - Check browser console for `demo-login OK` or error
   - Verify all env vars are set correctly
   - Ensure `CORS_ORIGINS` includes Vercel domain (no trailing slash)

---

## Demo URLs

After deployment, your URLs will be:

| Service | URL |
|---------|-----|
| **Frontend** | `https://your-app.vercel.app` |
| **API** | `https://your-api.up.railway.app` |
| **API Health** | `https://your-api.up.railway.app/` |

---

## Excel Import System

The system supports importing assets from Excel spreadsheets with production-safe idempotency.

### Rerun-Safe Imports

Imports are designed to be safely re-executable:

1. **Row Hash Tracking**: Each imported row gets a stable hash computed from its mapped values. Re-importing the same data with no changes will skip unchanged rows.

2. **ImportedRecord Table**: Every imported row creates a tracking record with:
   - Row position (sheet name, row number)
   - Row hash for change detection
   - Entity ID of created/updated record
   - Match key used for deduplication

3. **Execution Summary**: After import, you'll see:
   ```json
   {
     "success": true,
     "created": 10,              // New records created
     "updated": 5,               // Existing records updated
     "unchanged": 85,            // Rows with same hash, skipped
     "skipped": 2,               // Rows with validation issues
     "derivedIdentityCount": 0,  // Assets with fallback identity
     "matchKeyUsed": "externalRef"
   }
   ```

### Asset Identity Contract

**All asset matching is by `externalRef` only.**

Per the Asset Identity Contract (`docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md`):

- `externalRef` is the **business identity** for all assets
- It is **required** for all law-critical assets
- It is **immutable** after creation
- Database IDs must never be used for cross-import or business logic

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| `externalRef` (default) | Match by external reference/ID | **Always** - this is the required strategy |
| `fallback_acknowledged` | Allow auto-generated IDs | Only during initial data onboarding |

**Fallback Identities**

If `externalRef` is not available during import, the user can explicitly acknowledge fallback identity generation:

- Fallback formula: `DERIVED_ + hash(assetType + siteId + normalizedName)`
- Assets are marked with `derivedIdentity: true`
- These must be replaced with real utility IDs before production use
- UI displays warnings for assets with derived identities

### Canonical Field Registry

All target fields are validated against a typed registry:

- Only valid fields can be mapped (no arbitrary strings)
- Each field has a defined type (string, number, date, decimal, enum)
- Criticality levels: `law_critical`, `model_critical`, `optional`
- UI prevents selecting invalid fields

### Column Profiling

When uploading Excel files, each column is automatically profiled:

- **Type inference**: Detects string, number, date, boolean types
- **Empty rate**: Percentage of null/empty values
- **Example values**: First few non-empty values for preview
- **Unit detection**: Recognizes units like m, km, €, years in headers

### Import Workflow

1. **Upload**: Upload Excel file → sheets parsed and profiled
2. **Map**: Create column mapping (auto-suggestions provided)
3. **Validate**: Run validation report to check for issues
4. **Execute**: Run import with dry-run option first
5. **Re-execute**: Safe to re-run - unchanged rows skipped

### API Endpoints

```bash
# Upload Excel file
POST /imports/upload
Content-Type: multipart/form-data
file: <excel-file>

# Get sheet preview with column profiles
GET /imports/:id/sheets/:sheetId/preview

# Execute import (with options)
POST /imports/:id/execute
{
  "mappingId": "uuid",
  "sheetId": "uuid",
  "dryRun": true,              // Preview changes without writing
  "updateExisting": true,       // Update matched records
  "matchKeyStrategy": "auto"    // externalRef | name_siteId | auto
}
```

---

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGINS` in Railway includes the exact Vercel URL (no trailing slash)
- Redeploy API after changing CORS settings

### Database Connection
- Check `DATABASE_URL` is correctly set
- Ensure PostgreSQL is running in Railway

### Authentication Issues
- Verify `JWT_SECRET` is set
- Check browser console for token errors
- Clear localStorage and try again

### Build Failures
- Check Railway/Vercel build logs
- Ensure `pnpm` is available (Railway supports it)
- Verify `apps/api` or `apps/web` as root directory

---

## Share demo via Cloudflare Tunnel (single URL)

To share your **local** dev environment without maintaining two tunnels or updating `VITE_API_BASE_URL` when tunnels restart:

1. **Single tunnel for the web app only.** The frontend uses same-origin `/api` in dev (Vite proxy to `http://localhost:3000`), so no API tunnel or env is needed.

### Windows PowerShell

```powershell
# Terminal 1: API
cd c:\path\to\saas-monorepo
pnpm --filter api dev

# Terminal 2: Web (do not set VITE_API_BASE_URL). Binds to 0.0.0.0:5173, strictPort.
pnpm --filter web dev

# Terminal 3: One tunnel for web only
cloudflared tunnel --url http://localhost:5173
```

Share the URL cloudflared prints. Login page and "Use Demo" work; API calls go through the proxy. Restarting cloudflared gives a new URL but no env change.

See **README.md** → "Share demo via Cloudflare Tunnel (single URL)" for details and troubleshooting.

---

## Local Development

```bash
# Start database (if using Docker)
docker-compose up -d postgres

# API
cd apps/api
cp .env.example .env
# Edit .env with local database URL
pnpm dev

# Frontend (separate terminal)
cd apps/web
pnpm dev
```
