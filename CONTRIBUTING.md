# Contributing

## Dev environment setup

### Prerequisites

- Node 20+ (`nvm use` or `fnm use` — see `.nvmrc`)
- pnpm 9.15+ (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- Docker (for local PostgreSQL)

### First time

```bash
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d postgres
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env: set DATABASE_URL and JWT_SECRET
pnpm --filter api exec prisma migrate dev
pnpm --filter api exec prisma db seed
pnpm dev
```

Web: `http://localhost:5173` — click "Use Demo".

### After pulling changes

```bash
pnpm install                                    # in case deps changed
pnpm --filter api exec prisma migrate dev       # apply new migrations
pnpm dev
```

## Branching / PRs

- Work on feature branches off `main`.
- Keep PRs small and focused (one feature or fix).
- Include a short description of what changed and why.
- Ensure `pnpm typecheck` and `pnpm test` pass before pushing.

## Code style

- **Formatting:** Prettier (config in `packages/config/.prettierrc.js`). Auto-formats on save if IDE is configured.
- **Linting:** ESLint (configs in `packages/config/eslint/`).
- **TypeScript:** Strict mode. No `any` unless unavoidable (and commented).

```bash
pnpm lint         # lint all workspaces
pnpm typecheck    # type-check all workspaces
pnpm test         # run all tests (API only currently)
```

### API conventions

- NestJS modular architecture: one module per domain concept.
- Controller → Service → Repository pattern.
- Services receive `orgId` as first parameter (from `TenantGuard`).
- DTOs validated with `class-validator`.
- Finnish model names with ASCII-safe Prisma fields + `@map()` for DB columns.

### Frontend conventions

- Functional React components only.
- All hooks declared at top of component, before any `return`.
- `react-i18next` for all user-facing text — never hardcode strings.
- `formatCurrency()` from `utils/format.ts` for money display.
- State management via React Context (no Redux).
- Single `api.ts` client — all HTTP calls go through `api()` helper.

## Adding a new feature (checklist)

1. **Schema** (if needed): Add Prisma model in `apps/api/prisma/schema.prisma`, run `prisma migrate dev`.
2. **Backend**: Create module, controller, service, repository in `apps/api/src/<feature>/`. Register in `app.module.ts`.
3. **API types**: Add TypeScript interfaces in `apps/web/src/api.ts` (or `packages/domain/`).
4. **API client**: Add fetch methods in `apps/web/src/api.ts`.
5. **i18n**: Add translation keys in all three locale files (`fi.json`, `sv.json`, `en.json`).
6. **UI**: Add page/component in `apps/web/src/pages/` or `apps/web/src/components/`.
7. **Navigation**: Update `TabId` in `Layout.tsx` and routing in `App.tsx` if adding a new tab.
8. **Tests**: Add unit tests in `apps/api/src/<feature>/*.spec.ts`.
9. **Typecheck**: `pnpm typecheck` must pass.
10. **Demo**: Update `demo-bootstrap.service.ts` if the feature needs demo data.

## Running tests

```bash
# All tests
pnpm test

# API tests only
pnpm --filter api test

# Specific test file
pnpm --filter api exec jest src/demo/demo.constants.spec.ts

# Watch mode
pnpm --filter api exec jest --watch

# Coverage
pnpm --filter api exec jest --coverage
```

See [TESTING.md](TESTING.md) for more details.

## Prisma workflow

```bash
# After schema changes
pnpm --filter api exec prisma migrate dev --name describe_change

# Regenerate client (if EPERM on Windows, kill node processes first)
pnpm --filter api exec prisma generate

# Open Studio
pnpm --filter api exec prisma studio

# Reset DB (destructive)
pnpm --filter api exec prisma migrate reset
```
