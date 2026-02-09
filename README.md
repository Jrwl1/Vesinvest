# Plan20 — VA-talous

Water utility financial planning system for Finnish (and Nordic) small-to-medium water utilities. Helps operators build budgets, model revenue drivers, run multi-year projections, and justify tariff decisions — all from data that typically lives in Excel.

**Monorepo:** NestJS API (`apps/api`) + React / Vite web (`apps/web`). Shared packages: `domain` (types), `config` (ESLint, Prettier, TS).

**Docs:** For canonical doc set and read order see [docs/CANONICAL.md](docs/CANONICAL.md).

## Tech stack

- **Backend:** NestJS 9, Prisma 5 (PostgreSQL), Passport JWT, ExcelJS
- **Frontend:** React 18, Vite 4, TypeScript 5, react-i18next (FI / SV / EN)
- **Package manager:** pnpm 9.15 (workspaces)
- **Node:** 20+ (see `.nvmrc`)
- **Deploy:** Railway (API + Postgres), Vercel (web). Docker + Nixpacks configs included.
- **Local infra:** Docker Compose (Postgres 16 + MinIO) in `infra/docker/`

## Quickstart

```bash
# 1. Install dependencies
pnpm install

# 2. Start local Postgres (requires Docker)
docker compose -f infra/docker/docker-compose.yml up -d postgres

# 3. Configure API
cp apps/api/.env.example apps/api/.env
# Edit DATABASE_URL and JWT_SECRET

# 4. Run migrations + seed
pnpm --filter api exec prisma migrate dev
pnpm --filter api exec prisma db seed

# 5. Start both apps
pnpm dev
```

API runs on `http://localhost:3000`, web on `http://localhost:5173`.
Demo mode is **on by default** in dev — click "Use Demo" on the login page.

## Environment variables

### API (`apps/api/.env`) — see `apps/api/.env.example`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Token signing secret (32+ chars) |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | `production` disables demo mode |
| `CORS_ORIGINS` | Prod | — | Comma-separated allowed origins |
| `DEMO_MODE` | No | `true` in dev | Set `false` to disable demo |
| `DEMO_KEY` | No | — | Shared secret for demo auth |

### Web (`apps/web/.env`) — see `apps/web/.env.example`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | Prod only | In dev: `/api` (proxy) | API endpoint. Omit in dev to use same-origin proxy (single tunnel). |

## Common commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run API + web in parallel |
| `pnpm build` | Build packages then apps |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | TypeScript check all workspaces |
| `pnpm test` | Run tests (Jest, API only) |
| `pnpm --filter api dev` | API only |
| `pnpm --filter web dev` | Web only |
| `pnpm --filter api exec prisma studio` | Open Prisma Studio |
| `pnpm --filter api exec prisma migrate dev` | Create/apply migration |

## Demo mode

Demo is **on by default** in development. The login page always shows first; click **"Use Demo"** to enter.

- **Demo login** creates an empty org (no budgets, sites, or assets). The app uses a **manual-first** UX: all main tabs (Budget, Revenue, Projection, Settings) show the full layout with editable inputs defaulting to 0 (or sensible defaults). You can fill data manually or use **"Load demo data"** to seed a sample budget and projection (idempotent; safe to click again).
- `GET /demo/status` — reports whether demo is enabled
- `POST /auth/demo-login` — issues a demo JWT (empty org only)
- `POST /demo/seed` — seeds optional demo dataset (only when demo mode enabled; 404 in production)
- `POST /demo/reset` — wipes and re-seeds demo data

Disable locally: `DEMO_MODE=false` in `apps/api/.env`.

## CORS

- **Dev:** localhost:5173/5174, 127.0.0.1:5173/5174, localhost:3000 always allowed. `*.trycloudflare.com` also accepted. In demo mode, all origins are accepted.
- **Production:** Only `CORS_ORIGINS` entries.

Source: `apps/api/src/main.ts`

## Share demo via Cloudflare Tunnel (single URL)

Expose your local dev with **one** tunnel. The web app talks to the API via the Vite dev proxy (`/api` → `http://localhost:3000`), so you never set an API tunnel URL or update env when the tunnel restarts.

### Prerequisites

- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (e.g. `winget install Cloudflare.cloudflared` on Windows)

### Steps (Windows PowerShell)

```powershell
# 1. Start API (Terminal 1)
cd c:\Users\john\Plan20\saas-monorepo
pnpm --filter api dev

# 2. Start web dev server (Terminal 2). Do not set VITE_API_BASE_URL — default /api proxy is used.
#    Web runs at http://localhost:5173 (strictPort: true; host 0.0.0.0 for tunnel).
pnpm --filter web dev

# 3. Expose only the web port (Terminal 3)
cloudflared tunnel --url http://localhost:5173
```

Share the **single URL** that cloudflared prints (e.g. `https://something.trycloudflare.com`). Visitors get the login page; "Use Demo" works because the browser sends API requests to the same origin and Vite proxies them to the local Nest API.

### Why this works

- Frontend uses base URL `/api` in dev when `VITE_API_BASE_URL` is unset.
- Vite proxies ` /api/*` → `http://localhost:3000/*` (path rewritten; no CORS).
- Restarting cloudflared gives a new URL but no env change — the app keeps working.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| "Blocked request... allowedHosts" | Handled in `vite.config.ts` (`server.allowedHosts: ['.trycloudflare.com']`). |
| Demo / API calls fail | Ensure API is running on port 3000 and web was started without `VITE_API_BASE_URL` (or delete `apps/web/.env.local`). |
| Need to point at a separate API | Set `VITE_API_BASE_URL` in `apps/web/.env.local` (e.g. an API tunnel URL); proxy is not used. |

## Repo structure

```
apps/
  api/                 NestJS backend
    prisma/              Schema, migrations, seed
    src/
      auth/              JWT + demo login
      budgets/           Budget CRUD + import
      projections/       Projection engine + scenarios
      assumptions/       Financial assumptions
      demo/              Demo bootstrap/reset
      health/            Health endpoints
      tenant/            Multi-tenant guard
      assets/            (Legacy) Asset management
      imports/           (Legacy) Excel import pipeline
      mappings/          (Legacy) Column mapping
      sites/             (Legacy) Sites
  web/                 React + Vite frontend
    src/
      pages/             BudgetPage, RevenuePage, ProjectionPage, SettingsPage
      components/        Layout, LoginForm, ScenarioComparison, ...
      context/           NavigationContext, DemoStatusContext
      i18n/              FI / SV / EN translations
      api.ts             API client (~80 methods)
packages/
  config/              Shared ESLint, Prettier, TS configs
  domain/              Shared types/schemas
docs/                  Architecture, API, pivot docs, contracts
infra/docker/          docker-compose.yml (Postgres + MinIO)
```

## Further documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, auth model, invariants |
| [API Reference](docs/API.md) | All endpoints, auth requirements, error format |
| [Contributing](CONTRIBUTING.md) | Dev setup, code style, PR guidelines |
| [Tasks / Roadmap](docs/TASKS.md) | Now / Next / Later priorities |
| [Decisions (ADR)](docs/DECISIONS.md) | Key architectural decisions |
| [Prompts](docs/PROMPTS.md) | Cursor / AI prompt templates for this repo |
| [Deployment](DEPLOYMENT.md) | Railway + Vercel deployment guide |
| [Testing](TESTING.md) | Jest setup, test commands, troubleshooting |
| [Pivot Plan](docs/pivot/VA_BUDGET_PIVOT_PLAN.md) | Full pivot implementation plan |
| [Pivot Overview](docs/pivot/WATER_UTILITY_PIVOT_OVERVIEW.md) | Strategic context |

## License

MIT
