# Canonical documentation

Last updated: 2026-02-10

Use this file as the entry point for planning and product truth.

## How planning flows in this repo

1. `docs/PROJECT_STATUS.md` keeps a short "where we are now" snapshot.
2. `docs/ROADMAP.md` defines milestones to customer-ready V1 with done criteria.
3. `docs/SPRINT.md` holds the next 12 weeks of active work, max 5 items.
4. `docs/BACKLOG.md` holds structured epics/tasks not yet in sprint.
5. `docs/DECISIONS.md` is append-only ADR history and decision log.
6. `docs/WORKLOG.md` is append-only run history; each PLAN/DO/REVIEW run adds one line.

## Conflict resolution hierarchy

If documents disagree, use this precedence:

1. Code reality (`apps/**`, `packages/**`, Prisma schema, tests).
2. Latest customer facts (`docs/client/**` and customer clarifications in current planning session).
3. Accepted decisions in `docs/DECISIONS.md`.
4. Active planning docs (`docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/SPRINT.md`, `docs/BACKLOG.md`).
5. Supporting runbooks and historical notes.

Rules:
- For "what exists now", code wins.
- For "what V1 must deliver", latest customer facts plus accepted decisions win.
- If uncertain, write `TBD` and list what must be confirmed.

## Canonical V1 plan doc

- The single canonical V1 plan document is `docs/ROADMAP.md`.
- `docs/PROJECT_STATUS.md`, `docs/SPRINT.md`, and `docs/BACKLOG.md` must stay aligned with that roadmap.

## V1 baseline from customer clarifications

- VAT: all V1 calculations are VAT-free (0%).
- Base fee: modeled as annual total with yearly percent change/override.
- Connection fees: not a V1 must-have.
- Investment horizon: minimum 20 years.
- Depreciation: always split into baseline + investment-driven additional depreciation.
- Export: PDF must be a financing/cashflow report (diagram + compact table, multi-page allowed).
- Deployment model: single-tenant per customer, hosted service.

## Read order

1. `README.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/ROADMAP.md`
4. `docs/SPRINT.md`
5. `docs/BACKLOG.md`
6. `docs/DECISIONS.md`
7. `docs/ARCHITECTURE.md`
8. `docs/API.md`
9. `docs/CANONICAL_REPORT.md`

## Canonical set

- `README.md`: repo setup and runtime basics.
- `docs/PROJECT_STATUS.md`: current planning snapshot.
- `docs/ROADMAP.md`: canonical V1 milestone plan.
- `docs/SPRINT.md`: active 12-week execution set.
- `docs/BACKLOG.md`: prioritized pool for upcoming sprint pulls.
- `docs/DECISIONS.md`: accepted ADRs and pending decision records.
- `docs/ARCHITECTURE.md`: system architecture reality.
- `docs/API.md`: backend endpoint contract.
- `docs/CANONICAL_REPORT.md`: conflict-resolution and planning-change record.

## Supporting (not normative)

- `docs/DEPLOYMENT.md`
- `docs/TESTING.md`
- `docs/playbooks/PROMPTS.md`
- `docs/KVA_REGRESSION_DEBUG.md`
- `docs/TASKS.md`

## Non-canonical / historical planning references

These remain for traceability and must not drive current scope:

- `docs/EXCEL_IMPORT_KVA_PERFECT_PLAN.md`
- `docs/SANITY_CHECK_KVA_PERFECT_PLAN.md`
- `docs/EXCEL_IMPORT_VA_FULL_PLAN.md`
- `docs/EXCEL_IMPORT_VA_PIVOT_PLAN.md`
- `docs/EXCEL_IMPORT_VA_PLAN.md`
- `docs/EXCEL_IMPORT_GUIDE.md`
- `docs/KVA_DRIVERS_LOG_STAGES.md`
- `docs/pivot/VA_BUDGET_PIVOT_PLAN.md`
- `docs/pivot/EXCEL_IMPORT_PHILOSOPHY.md`
- `docs/pivot/WATER_UTILITY_PIVOT_OVERVIEW.md`

Any new "perfect/full/pivot" plan document is non-canonical by default unless explicitly added to the canonical set above.
