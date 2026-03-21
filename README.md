# Vesipolku

Water utility financial planning system for Finnish small-to-medium water utilities. Vesipolku uses VEETI as the default seed and comparator, lets operators correct bad historical years with statement-backed manual capture, and builds forecast scenarios and reports from effective year data.

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
Local development now defaults to **trial mode**, so demo sign-in is unavailable unless you opt into internal demo mode.

## Environment variables

### API (`apps/api/.env`) — see `apps/api/.env.example`

| Variable       | Required | Default       | Description                      |
| -------------- | -------- | ------------- | -------------------------------- |
| `DATABASE_URL` | Yes      | —             | PostgreSQL connection string     |
| `JWT_SECRET`   | Yes      | —             | Token signing secret (32+ chars) |
| `PORT`         | No       | `3000`        | Server port                      |
| `NODE_ENV`     | No       | `development` | `production` selects production app mode unless `APP_MODE` overrides it |
| `CORS_ORIGINS` | Prod     | —             | Comma-separated allowed origins  |
| `APP_MODE`     | No       | `trial` in non-prod, `production` in prod | `internal_demo` enables demo login and demo reset/seed endpoints |
| `DEMO_MODE`    | No       | Legacy fallback only | Set `true` to force internal demo mode when `APP_MODE` is unset |
| `DEMO_KEY`     | No       | —             | Shared secret for demo auth      |

### Web (`apps/web/.env` or `apps/web/.env.development`) — see `apps/web/.env.example`

| Variable            | Required  | Default                         | Description                                                                                                                                                                                                                                     |
| ------------------- | --------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Prod only | In dev: `http://localhost:3000` | API endpoint. For local testing use `http://localhost:3000` (or leave unset; same default). `.env.development` sets this for dev. **Restart the web dev server** after changing env (`pnpm dev` or `pnpm --filter web dev`) so Vite reloads it. |

## Release gates

Before releasing, run the **build gate** and **pre-release security checklist** in [DEPLOYMENT.md](DEPLOYMENT.md). Required evidence: commit hash, date, and auth controller spec result (`pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts`).

## Auth rate-limit deployment contract

- Local and other non-production runs may use the in-process auth limiter.
- Production must set `AUTH_RATE_LIMIT_MODE=edge`.
- The trusted reverse proxy must rate-limit `POST /auth/login`, `POST /auth/demo-login`, and `POST /auth/invitations/accept`.
- The trusted reverse proxy must strip any client-supplied `x-auth-rate-limit-verified` header and inject the configured `AUTH_EDGE_RATE_LIMIT_SECRET` before forwarding to the API.
- `TRUST_PROXY` must reflect the real proxy topology so `req.ip` resolves through trusted proxies only.

## Common commands

| Command                                     | Description                     |
| ------------------------------------------- | ------------------------------- |
| `pnpm dev`                                  | Run API + web in parallel       |
| `pnpm build`                                | Build packages then apps        |
| `pnpm lint`                                 | Lint all workspaces             |
| `pnpm typecheck`                            | TypeScript check all workspaces |
| `pnpm test`                                 | Run tests (Jest, API only)      |
| `pnpm --filter api dev`                     | API only                        |
| `pnpm --filter web dev`                     | Web only                        |
| `pnpm --filter api exec prisma studio`      | Open Prisma Studio              |
| `pnpm --filter api exec prisma migrate dev` | Create/apply migration          |

## Current product flow

The active V2 product flow is:

1. Connect a utility to VEETI.
2. Review imported years in the V2 Overview.
3. Keep VEETI data or correct bad years with manual effective values.
4. Sync trusted years into baseline budgets.
5. Create forecast scenarios.
6. Generate shareable reports.

The strategic direction is documented in [docs/PLAN20_V2_PIVOT_PLAN.md](docs/PLAN20_V2_PIVOT_PLAN.md).

## Demo mode

Development now defaults to **trial mode**, not demo mode. The login page checks `GET /demo/status` and only shows **"Try Demo"** when the backend reports `appMode=internal_demo`.

- **Demo login** creates an empty org and opens the current V2 shell. The main workflow is Overview -> Forecast -> Reports. Demo data can be seeded to show a baseline budget, a forecast scenario, and report flow.
- `GET /demo/status` — reports whether demo is enabled
- `POST /auth/demo-login` — issues a demo JWT (empty org only)
- `POST /demo/seed` — seeds optional demo dataset (only when demo mode enabled; 404 in production)
- `POST /demo/reset` — wipes and re-seeds demo data

Enable internal demo locally with either `APP_MODE=internal_demo` (preferred) or `DEMO_MODE=true` (legacy fallback) in `apps/api/.env`.
Keep local trial mode by leaving both unset, or force trial explicitly with `APP_MODE=trial`.

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
cd <path-to-repo>\saas-monorepo
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

| Problem                           | Fix                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| "Blocked request... allowedHosts" | Handled in `vite.config.ts` (`server.allowedHosts: ['.trycloudflare.com']`).                                          |
| Demo / API calls fail             | Ensure API is running on port 3000 and web was started without `VITE_API_BASE_URL` (or delete `apps/web/.env.local`). |
| Need to point at a separate API   | Set `VITE_API_BASE_URL` in `apps/web/.env.local` (e.g. an API tunnel URL); proxy is not used.                         |

## Repo structure

```
apps/
  api/                 NestJS backend
    prisma/              Schema, migrations, seed
    src/
      auth/              JWT + demo login
      budgets/           Budget CRUD + import
      v2/                Overview / forecast / report orchestration API
      veeti/             VEETI sync, snapshots, overrides, trust logic
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
      v2/                OverviewPageV2, EnnustePageV2, ReportsPageV2
      pages/             Legacy pre-V2 pages
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

| Document                                                     | Description                                      |
| ------------------------------------------------------------ | ------------------------------------------------ |
| [Architecture](docs/ARCHITECTURE.md)                         | System design, data flow, auth model, invariants |
| [API Reference](docs/API.md)                                 | All endpoints, auth requirements, error format   |
| [Contributing](CONTRIBUTING.md)                              | Dev setup, code style, PR guidelines             |
| [V2 Direction Plan](docs/PLAN20_V2_PIVOT_PLAN.md)            | Effective-year product direction and sequencing  |
| [Decisions (ADR)](docs/DECISIONS.md)                         | Key architectural decisions                      |
| [Prompts](docs/playbooks/PROMPTS.md)                         | Cursor / AI prompt templates for this repo       |
| [Deployment](DEPLOYMENT.md)                                  | Railway + Vercel deployment guide                |
| [Testing](TESTING.md)                                        | Jest setup, test commands, troubleshooting       |

## License

MIT
