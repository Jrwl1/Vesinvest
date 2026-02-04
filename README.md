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
