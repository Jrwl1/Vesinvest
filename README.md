# SaaS Monorepo

Monorepo: **NestJS API** (`apps/api`) + **React + Vite web** (`apps/web`). Shared packages: `domain` (types/schemas), `config` (ESLint, Prettier, TypeScript).

## Getting started

**Node:** Use the version in `.nvmrc` (e.g. `nvm use` or `fnm use`). Project expects Node 20+.

**Install and run:**

```bash
pnpm install
pnpm dev
```

- `pnpm dev` starts both API and web in parallel (API default port 3000, web typically 5173).
- Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL` and `JWT_SECRET` before running.

## Common commands

| Command       | Description                          |
|---------------|--------------------------------------|
| `pnpm dev`    | Run API + web in parallel            |
| `pnpm build`  | Build packages then apps             |
| `pnpm lint`   | Lint all workspaces (excl. config)   |
| `pnpm typecheck` | TypeScript check (excl. config)   |
| `pnpm test`   | Run tests in all workspaces (excl. config) |

Single-app dev: `pnpm --filter api dev` or `pnpm --filter web dev`.

## Demo mode

**Development:** Demo mode is **on by default** so you can use “Use Demo” in the web app without real credentials.

- **Disable locally:** Set `DEMO_MODE=false` in `apps/api/.env`.
- **Endpoints (when enabled):**
  - `GET /demo/status` — health/status, reports whether demo is enabled.
  - `POST /auth/demo-login` — web “Use Demo” button calls this to get a token.

**Production:** Demo is **off** when `NODE_ENV=production`. Do not enable it in production unless you run a dedicated demo instance.

**Troubleshooting:**

- **“Use Demo” fails / 404 on demo-login:** Demo is disabled (`DEMO_MODE=false`) or the frontend is pointing at the wrong API (check `VITE_API_BASE_URL`).
- **CORS errors:** Add your frontend origin to `CORS_ORIGINS` in `apps/api/.env` (see below).

## CORS

- **Development:** In addition to `CORS_ORIGINS`, the API allows: `http://localhost:5173`, `http://localhost:5174`, `http://127.0.0.1:5173`, `http://127.0.0.1:5174`, `http://localhost:3000`.
- **Production:** Only origins listed in `CORS_ORIGINS` (comma-separated) are allowed.

If your frontend runs on another port, add it to `CORS_ORIGINS` in `apps/api/.env`.

## Share demo via Cloudflare Tunnel

You can expose your local dev server to the internet using [Cloudflare quick tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) — no account or dashboard setup needed.

### Prerequisites

Install `cloudflared`:

```powershell
# Windows (winget)
winget install Cloudflare.cloudflared

# Or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

### Step 1: Start dev servers

```powershell
pnpm dev
```

This starts the API on port 3000 and web on port 5173. The web dev server must bind to all interfaces:

```powershell
# If pnpm dev doesn't pass --host, start web separately:
pnpm --filter web dev -- --host 0.0.0.0
```

### Step 2: Open tunnels (two separate terminals)

```powershell
# Terminal 1 — API tunnel
cloudflared tunnel --url http://localhost:3000

# Terminal 2 — Web tunnel
cloudflared tunnel --url http://localhost:5173
```

Each command prints a URL like `https://random-words.trycloudflare.com`. Note both URLs — **both tunnels must stay running**. If you restart the API tunnel, you get a new URL and must update Step 3 and restart the web dev server.

### Step 3: Point the web app at the API tunnel

Create (or edit) `apps/web/.env.local`:

```env
VITE_API_BASE_URL=https://your-api-tunnel.trycloudflare.com
```

Then restart the web dev server so Vite picks up the new env var. External users will now reach your local API through the tunnel.

### Step 4: Share the web tunnel URL

Give external users the **web tunnel URL** (e.g. `https://your-web-tunnel.trycloudflare.com`). They click "Kokeile demoa" / "Use Demo" and are in.

### CORS

In demo mode (the default for local dev), the API accepts requests from **any origin**, so Cloudflare tunnel URLs work automatically — no `CORS_ORIGINS` config needed.

If you've disabled demo mode (`DEMO_MODE=false`), the API still accepts `*.trycloudflare.com` origins in dev. For other tunnel tools, add the origin to `CORS_ORIGINS` in `apps/api/.env`.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| **"Demo mode not available" + CORS / status (null)** | The browser never got a response from the API. **1)** Ensure the **API** is running locally (`pnpm dev` or the API process). **2)** Ensure the **API tunnel** is running (`cloudflared tunnel --url http://localhost:3000`) and note its URL. **3)** Set `VITE_API_BASE_URL` in `apps/web/.env.local` to that **exact** API tunnel URL (it changes every time you start the tunnel). **4)** Restart the web dev server so Vite picks up `.env.local`. |
| "Blocked request... allowedHosts" | In `apps/web/vite.config.ts` set `server.allowedHosts: ['.trycloudflare.com']` (dev only). |
| CORS error in browser (with a status code) | Restart API after changing `.env`. Check `DEMO_MODE` is not `false`. |
| `ERR_CONNECTION_REFUSED` | Ensure `--host 0.0.0.0` is passed to Vite. |
| Demo login fails | Confirm `VITE_API_BASE_URL` points to the API tunnel (not web tunnel). Restart Vite. |
| Tunnel URL changed | Quick tunnels get a new URL each run. Update `VITE_API_BASE_URL` and restart. |
| File upload fails | Check the API tunnel is reachable (`curl https://your-api-tunnel.trycloudflare.com/health/live`). |

## Project structure

```
apps/api       NestJS API
apps/web       React + Vite app
packages/domain   Shared types/schemas
packages/config   ESLint, Prettier, TS configs
pnpm-workspace.yaml
.nvmrc         Node version (20)
```

## License

MIT. See the LICENSE file for details.
