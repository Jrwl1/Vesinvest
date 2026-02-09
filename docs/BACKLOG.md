# Backlog

- **ROADMAP** defines milestones and epics; it drives what we commit to next.
- **SPRINT** holds at most 5 active items drawn from this backlog; "do" executes those.
- **BACKLOG** is the unordered pool; items move to Sprint when prioritised, or to Done when completed (with evidence).

## Inbox (uncategorized)

- Number input UX audit (comma vs dot across pages).

## Candidates for next sprint

- Add frontend tests (Vitest + React Testing Library) for demo login, budget CRUD, KVA confirm flow.
- Fix DEPLOYMENT.md to reflect VA budget pivot and explicit demo login (remove "Asset Maintenance" refs).
- Update TESTING.md test suite table to list current API spec files (17+).
- Add CI workflow (lint, typecheck, test) — GitHub Actions.
- Replace or modularise `App.css` (single 7k-line file); consider per-page CSS or utility approach.

## Later

- Multi-budget comparison in RevenuePage UI (budget selector).
- PDF export for projection reports (currently CSV only).
- Regulatory / tariff export format (e.g. FACIT) — pending customer input.
- Role-based access control enforcement (UserRole model exists but not used).
- Decide fate of legacy modules (Assets, Imports, Mappings, Maintenance, PlanningScenarios): feature-flag, remove, or keep.
- MinIO integration: docker-compose provisions it but nothing uses it. Remove or wire up.

## Done (with evidence/commit)

- (None yet.)
