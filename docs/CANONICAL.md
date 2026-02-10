# Canonical documentation

Use this file as the entry point for planning and product truth.

## Conflict resolution hierarchy

If documents disagree, use this precedence:

1. Code reality (`apps/**`, `packages/**`, Prisma schema, tests).
2. Latest customer facts (`docs/client/**` and uploaded customer files in repo).
3. Accepted decisions in `docs/DECISIONS.md`.
4. Active planning docs (`docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/SPRINT.md`, `docs/BACKLOG.md`).
5. Supporting runbooks and historical notes.

Rules:
- For "what exists now", code wins.
- For "what V1 must deliver", latest customer facts + accepted decisions win.
- If uncertain, write `TBD` and list the exact confirmation needed.

## V1 planning baseline

- Deployment model: single-tenant per customer (one web app + one API + one DB per customer).
- Do not assume shared runtime multi-tenancy for V1 planning.
- Keep org-scoping checks in code even in single-tenant deployments.

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
- `docs/ROADMAP.md`: milestone path to V1.
- `docs/SPRINT.md`: current 1-2 week execution set.
- `docs/BACKLOG.md`: prioritized pool for future sprint pulls.
- `docs/DECISIONS.md`: accepted ADRs and pending decision records.
- `docs/ARCHITECTURE.md`: system architecture reality.
- `docs/API.md`: backend endpoint contract.
- `docs/CANONICAL_REPORT.md`: conflict resolution log for planning passes.

## Supporting (not normative)

- `docs/DEPLOYMENT.md`
- `docs/TESTING.md`
- `docs/playbooks/PROMPTS.md`
- `docs/KVA_REGRESSION_DEBUG.md`
- `docs/TASKS.md`

## Non-canonical / historical planning docs

These are historical and must not drive current scope:

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

Any new "perfect/full/pivot" plan document is non-canonical by default unless explicitly added above.
