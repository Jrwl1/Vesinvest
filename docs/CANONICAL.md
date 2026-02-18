# Canonical documentation

Last updated: 2026-02-10

Use this file as the entry point for planning and product truth.

## Top-level OS contract

- `AGENTS.md` is the operating contract for PLAN/DO/REVIEW behavior.
- If there is any conflict about agent behavior, `AGENTS.md` wins.

## Conflict resolution hierarchy

Use this order for conflicts:

1. `AGENTS.md` for operating behavior and file permissions.
2. Code reality (`apps/**`, `packages/**`, Prisma schema, tests) for implemented behavior.
3. `docs/client/**` for customer requirements and scope.
4. Accepted ADRs in `docs/DECISIONS.md`.
5. Active planning docs (`docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/SPRINT.md`, `docs/BACKLOG.md`).
6. Supporting and historical docs.

Rules:
- For "what exists now", code wins.
- For "what must be delivered", customer facts in `docs/client/**` win.
- If uncertain, write `TBD` and assign owner.

## Language policy

- Preserve each file's current language.
- Do not rewrite documents just to translate language.
- New text in a file must follow that file's current language style.

## Canonical V1 plan doc

- The single canonical V1 plan document is `docs/ROADMAP.md`.
- `docs/PROJECT_STATUS.md`, `docs/SPRINT.md`, and `docs/BACKLOG.md` must stay aligned with it.

## Read order

1. `AGENTS.md`
2. `docs/CANONICAL.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/ROADMAP.md`
5. `docs/SPRINT.md`
6. `docs/BACKLOG.md`
7. `docs/DECISIONS.md`
8. `docs/CANONICAL_REPORT.md`
9. `docs/client/**`

## Canonical set

- `AGENTS.md`: mode router and execution contract.
- `docs/CANONICAL.md`: precedence and canonical set.
- `docs/PROJECT_STATUS.md`: current planning snapshot.
- `docs/ROADMAP.md`: canonical V1 milestones and done criteria.
- `docs/SPRINT.md`: active DO queue (5 items).
- `docs/BACKLOG.md`: structured future tasks and TBDs.
- `docs/DECISIONS.md`: ADR history and locked decisions.
- `docs/CANONICAL_REPORT.md`: change and conflict log.

## Supporting (not normative)

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DEPLOYMENT.md`
- `docs/TESTING.md`
- `docs/playbooks/PROMPTS.md`
- `docs/KVA_REGRESSION_DEBUG.md`
- `docs/TASKS.md`

## Non-canonical / historical planning references

These are traceability references only and must not drive active scope:

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
