# Project status

Last updated: 2026-02-10

## Goal

Deliver a customer-ready V1 for Finnish water-utility planning that is deployable, security-reviewed, and operable for one customer tenant at a time.

## Active milestone

**M0: Lock V1 scope with customer** (see `docs/ROADMAP.md`).

## Current state

- Code reality: KVA import preview/confirm, valisummat vs rivit handling, revenue drivers persistence, and projections are implemented.
- Auth/tenant model: JWT + org scoping exists; demo/dev bypass paths exist and must be disabled in production runtime.
- Deploy/ops reality: repository docs still describe Railway/Vercel as historical deployment path; Render V1 path is now planned in roadmap.
- Customer facts available: `docs/client/*.docx` and `docs/client/*.xlsx`.
- Planning docs were updated to align scope, milestones, backlog, and sprint around a single-tenant Render V1.

## V1 definition (draft)

**In scope:**
- Single-tenant delivery per customer (one web app + one API + one DB).
- Customer must-haves from source docs: 3-year base data, 20-year planning controls, pricing scenario capability, investment/depreciation planning support.
- Security minimum bar, deploy playbook, and release gates.

**Out of scope unless customer escalates:**
- Multi-budget comparison UX.
- Regulatory export format before requirement lock.
- Full RBAC rollout and legacy module consolidation.

## Blockers / decisions needed

1. Confirm VAT handling for water/wastewater pricing (TBD).
2. Confirm final tariff model details (base fee logic and meter-size rule changes).
3. Confirm whether connections/connection fees are mandatory in V1.
4. Confirm whether PTS input must be full 20 years or can start with shorter horizon plus rollout plan.
5. Confirm first pilot acceptance output format (screen only vs CSV/PDF/regulatory export).

## Next 5 actions

1. Run customer decision closeout for all blockers in M0.
2. Convert customer answers into locked acceptance criteria and backlog priorities.
3. Finalize Render per-customer deployment checklist with backup/restore and migration guardrails.
4. Finalize security release checklist and ownership accountability map.
5. Lock smoke/E2E and CI/manual release gates before pilot go-live.

## Key links

- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`

