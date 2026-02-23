# Site Audit Login to Export (2026-02-23)

## Scope
- Fresh database run: login -> legal accept -> VEETI connect/import -> budget generation -> projection compute -> benchmark comparison.
- Target utility Y-tunnus: `0180030-9`.
- UI + API verification.

## Environment
- Date: 2026-02-23
- API: `http://localhost:3000`
- Web: `http://localhost:5173`
- Seed user: `admin@plan20.dev` / `admin123`
- Seed org: `plan20-demo`

## End-to-end result
- PASS: Login works on empty DB.
- PASS: Legal acceptance flow works and unlocks org.
- PASS: VEETI search by `0180030-9` returns `Kronoby vatten och avlopp ab`.
- PASS: VEETI connect + snapshot fetch succeeds.
- PASS: Budget generation from VEETI years succeeds (`2022`, `2023`, `2024`).
- PASS: Projection compute succeeds with 21 years and populated graph/KPIs.
- PASS: Benchmark page loads (no infinite loading).
- PASS: Peer comparison now includes real other utilities (not empty).
- PASS: Connect page no longer shows `limit must not be greater than 50...` validation error.

## Evidence (artifacts)
- Benchmark UI with peer list: `.playwright-cli/page-2026-02-23T16-06-36-104Z.png`
- Projection graph UI: `.playwright-cli/page-2026-02-23T16-07-21-745Z.png`
- Connect search UI (no limit error): `.playwright-cli/page-2026-02-23T16-08-13-142Z.png`

## API evidence highlights
- `/veeti/search?q=0180030-9&limit=25` -> returns VEETI org `Id=1535`, `Nimi=Kronoby vatten och avlopp ab`, `YTunnus=0180030-9`.
- `/veeti/connect` -> linked + snapshots upserted.
- `/veeti/generate-budgets` -> 3 budgets created for years 2022-2024.
- `/projections/compute-for-budget` -> 21 projection years generated.
- `/benchmarks/peer-group` -> `peerCount=12`, peers populated with real VEETI org names/Y-tunnus.

## Issues fixed during audit
1. VEETI search query validation bug (`limit` treated as string) fixed via DTO transform.
- File: `apps/api/src/veeti/dto/veeti-search.dto.ts`

2. VEETI search completeness for Y-tunnus improved with paged deterministic scan.
- File: `apps/api/src/veeti/veeti.service.ts`

3. Benchmark load blocker fixed:
- Deduplicated concurrent recompute calls to prevent write/read race conflicts.
- Tolerated optional VEETI entities (`investointi`, `verkko`) instead of failing whole org metric fetch.
- Added VEETI-wide peer samples so single-tenant orgs still get real peer-company comparison.
- File: `apps/api/src/veeti/veeti-benchmark.service.ts`

4. Benchmark peer panel now shows total peers and sample peer companies.
- Files:
  - `apps/web/src/components/Benchmark/BenchmarkPeerGroup.tsx`
  - `apps/web/src/api.ts`
  - `apps/web/src/App.css`

5. Mojibake hardening and prevention:
- Added text-integrity check for BOM/mojibake patterns.
- Hooked into root lint pipeline.
- Replaced fragile password placeholder glyphs with ASCII in login form.
- Files:
  - `scripts/check-text-integrity.mjs`
  - `package.json`
  - `apps/web/src/components/LoginForm.tsx`

6. Dev startup resilience for Prisma client/schema mismatch.
- Run `prisma generate` before API dev server starts.
- File: `apps/api/package.json`

## Tab consolidation recommendations (6 tabs -> leaner UX)
1. Merge `Dashboard` + `Vertailu` into one `Overview` tab.
- Keep KPI strip + quick benchmark cards together.
- Move deep benchmark charts into collapsible section in same page.

2. Convert `Connect` into setup mode, not permanent top-level tab.
- Before first link: show as top-level onboarding step.
- After linked: move to `Settings > Data sources`.

3. Keep `Budget` and `Projection` as separate primary tabs.
- They represent distinct workflows and should stay first-class.

4. Keep `Settings`, but role-gate secondary admin controls.
- For non-admin users, show only relevant settings blocks.

### Suggested final main nav
- `Overview`
- `Budget`
- `Projection`
- `Settings`

(Connect lives under Settings after onboarding.)

## Remaining risk notes
- `benchmarks/:year` and `peer-group` now work reliably, but benchmark recompute is still network-heavy by design (VEETI-wide pulls).
- Existing historical docs contain older mojibake text snippets; runtime UI paths validated in this audit are clean.
