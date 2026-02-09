> This file contains operational AI/Cursor prompt recipes (not product requirements).  
> If anything conflicts, [docs/CANONICAL.md](../CANONICAL.md) and code win.

# Cursor / AI Prompt Templates

Repo-specific prompts for working with this codebase. Copy-paste and adapt.

## How to work in this repo

- **Monorepo:** pnpm workspaces. Root commands (`pnpm dev`, `pnpm lint`, etc.) run across workspaces.
- **Backend:** NestJS in `apps/api/`. Modular architecture. Every module has controller, service, repository.
- **Frontend:** React + Vite in `apps/web/`. Single `api.ts` client. `react-i18next` for all strings.
- **DB:** Prisma ORM. Schema in `apps/api/prisma/schema.prisma`. Finnish model names with `@map()`.
- **Auth:** JWT via Passport. `TenantGuard` scopes all queries by `orgId`.
- **i18n:** Three locale files (`fi.json`, `sv.json`, `en.json`). Always add keys to all three.
- **Hooks rule:** All React hooks must be declared before any conditional `return` in a component.
- **Typecheck:** Run `pnpm typecheck` after changes. Fix all errors before committing.

## Prompt: Make a safe change

```
You have full access to this repo (pnpm monorepo: apps/api NestJS, apps/web React+Vite).

Task: [describe change]

Rules:
1. Read the relevant files before editing. Never assume structure.
2. For backend changes: follow Controller → Service → Repository pattern.
   Register new modules in apps/api/src/app.module.ts.
3. For frontend changes: add i18n keys to ALL three locale files
   (apps/web/src/i18n/locales/fi.json, sv.json, en.json).
4. All React hooks must be at the top of the component, before any return.
5. Use formatCurrency() from utils/format.ts for money display.
6. Run pnpm typecheck after changes and fix any errors.
7. Do not auto-login or auto-bypass the login page.
8. Keep the change minimal; prefer editing existing files over creating new ones.
```

## Prompt: Refactor with guardrails

```
Refactor: [describe refactoring goal]

Guardrails:
1. Read all affected files first. List them before making changes.
2. Do NOT change public API signatures (controller routes, service method params)
   unless explicitly asked.
3. Preserve existing tests. If you move code, update imports in spec files.
4. After refactoring, verify:
   - pnpm typecheck passes (both apps/api and apps/web)
   - pnpm test passes (apps/api)
5. Org isolation (TenantGuard + orgId scoping) must remain intact.
6. Do not remove i18n keys; add new ones if needed.
7. Summarize: files changed, lines added/removed, any behavioral differences.
```

## Prompt: Debug failing test or build

```
I have a failing [test / build / typecheck]. Here is the error:

[paste error]

Debug steps:
1. Read the file mentioned in the error and its immediate dependencies.
2. Check if the error is caused by:
   - Missing import or wrong path
   - Type mismatch (Prisma schema change not reflected in TS types)
   - React hooks called conditionally or after early return
   - Finnish locale formatting (comma vs dot in number inputs)
   - Prisma EPERM on Windows (file lock on query_engine DLL)
3. Propose the minimal fix. Show the exact edit.
4. Verify the fix compiles: run pnpm typecheck.
5. If it's a test failure, run just that test file:
   pnpm --filter api exec jest <path-to-spec>
```

## Prompt: Add endpoint + feature end-to-end

```
Add a new feature: [describe feature]

Implementation order:
1. **Schema** (if needed): Add Prisma model in apps/api/prisma/schema.prisma.
   Use Finnish names with @map() for DB columns. Run prisma migrate dev.
2. **Backend module**: Create apps/api/src/<feature>/:
   - <feature>.module.ts (import PrismaModule)
   - <feature>.controller.ts (routes with @UseGuards(JwtAuthGuard, TenantGuard))
   - <feature>.service.ts (orgId as first param to all methods)
   - <feature>.repository.ts (Prisma queries, scoped by orgId)
   - Register module in apps/api/src/app.module.ts
3. **API client**: Add types and fetch methods in apps/web/src/api.ts.
4. **i18n**: Add keys to fi.json, sv.json, en.json.
5. **UI**: Add page or component. Wire to navigation if new tab.
6. **Demo data**: Update apps/api/src/demo/demo-bootstrap.service.ts if needed.
7. **Typecheck**: pnpm typecheck must pass.
8. **Summary**: List all files created/modified.
```

## Prompt: Fix CORS / tunnel / external access issue

```
I'm getting [CORS error / "Demo mode not available" / connection refused] when
accessing the app through [Cloudflare tunnel / external URL / different port].

Debug:
1. Read apps/api/src/main.ts — check isOriginAllowed() function and CORS config.
2. Check apps/web/.env.local — VITE_API_BASE_URL must match the CURRENT API tunnel URL.
3. Check apps/web/vite.config.ts — server.allowedHosts must include the tunnel domain.
4. Verify demo mode: isDemoModeEnabled() in apps/api/src/demo/demo.constants.ts.
5. In demo mode, ALL origins should be accepted (non-production only).
6. If the API tunnel restarted, the URL changed. Update .env.local and restart web.
7. Never loosen production CORS. Only adjust dev/demo behavior.
```
