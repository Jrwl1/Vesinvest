# Tasks / Roadmap

## Now

Items discovered from code, TODOs, and missing pieces.

| # | Task | Location / Evidence |
|---|------|---------------------|
| 1 | **Add frontend tests** — web app has zero tests. At minimum: Vitest + React Testing Library for critical flows (demo login, budget CRUD, projection compute). | `apps/web/` — no `*.spec.*` or `*.test.*` files |
| 2 | **Replace `App.css` monolith** — single 118KB CSS file. Extract per-page/component CSS modules or adopt a utility framework. | `apps/web/src/App.css` |
| 3 | **Fix stale DEPLOYMENT.md references** — still says "Asset Maintenance app" and references auto-login behavior that was removed. Update to reflect VA budget pivot and explicit demo login. | `DEPLOYMENT.md` lines 3, 220 |
| 4 | **Update TESTING.md test suite table** — lists only 3 test files; there are now 17 `.spec.ts` files. | `TESTING.md` line 59-63 |
| 5 | **Clean up legacy modules** — Assets, Sites, Imports, Mappings, Maintenance, PlanningScenarios are still compiled and routed. Decide: feature-flag, remove, or keep. | `apps/api/src/app.module.ts` |
| 6 | **Swagger / OpenAPI spec** — no API documentation beyond this repo's markdown. Add `@nestjs/swagger` for auto-generated docs. | No swagger/openapi files found |
| 7 | **CI pipeline** — no GitHub Actions or any CI config. Add lint + typecheck + test workflow. | No `.github/` directory |
| 8 | **Number input UX audit** — `type="number"` inputs with Finnish locale formatting have caused bugs before (comma vs dot). Audit remaining number inputs across all pages. | `apps/web/src/pages/ProjectionPage.tsx` (fixed), `RevenuePage.tsx` (uses `type="number"`) |

## Next

| # | Task | Notes |
|---|------|-------|
| 9 | **Phase 5+ of pivot plan** — reporting, dashboards, regulatory export. | `docs/pivot/VA_BUDGET_PIVOT_PLAN.md` |
| 10 | **Multi-budget support** — UI currently auto-selects first budget. Add budget selector to RevenuePage and cross-budget comparison. | `apps/web/src/pages/RevenuePage.tsx` line 23 |
| 11 | **Wastewater separate drivers** — currently water and wastewater share volume/price structure. Real utilities may have different billing models. | `apps/api/prisma/schema.prisma` `Tuloajuri` |
| 12 | **PDF export** — projection report as PDF (currently CSV only). | `apps/api/src/projections/projections.controller.ts` |
| 13 | **Role-based access control** — `UserRole` model exists but roles are not enforced beyond JWT claims. | `apps/api/prisma/schema.prisma` |

## Later

| # | Task | Notes |
|---|------|-------|
| 14 | **Production hardening** — rate limiting, request size limits, Helmet headers. | — |
| 15 | **MinIO integration** — docker-compose provisions MinIO but nothing uses it. Decide: use for file storage or remove. | `infra/docker/docker-compose.yml` |
| 16 | **Real user management** — currently only demo user + dev token. Add registration, password reset, org invites. | — |
| 17 | **Mobile / responsive** — UI is desktop-focused. Improve for tablet/mobile access. | — |
