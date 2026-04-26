# Canonical Summary

Last updated: 2026-04-27

The repository has moved from the former AIOS command protocol to a harness-engineering model.

## Source Of Truth

- Root agent map: `AGENTS.md`
- Repository knowledge index: `docs/index.md`
- Product truth: `docs/product/index.md`
- Architecture: `docs/architecture/index.md`
- Quality gates: `docs/quality/index.md`
- Harness and local validation: `docs/harness/index.md`
- Active execution plans: `docs/exec-plans/active/`

## Conflict Resolution

Use this order for conflicts:

1. Code, tests, schemas, scripts, and CI for implemented behavior.
2. Indexed product and architecture docs for intended behavior.
3. Accepted ADRs in `docs/DECISIONS.md`.
4. Customer-source documents under `docs/client/**` when explicitly needed for the task.
5. Historical audits, sprint records, work logs, and canonical reports for traceability only.

Rules:

- For what exists now, code wins.
- For what must be delivered, current product docs and explicitly supplied customer facts win.
- If a repeated instruction matters, promote it into a script, lint rule, test, generated map, or indexed doc.
- Do not expand `AGENTS.md` into a policy manual.

## Retired Protocols

`HUMANAUDIT`, `PLAN`, `RUNSPRINT`, `DO`, `OK GO`, and `CANCEL` are historical terms only. They do not route current agent behavior.

## Historical References

The following remain useful for traceability but are not default execution inputs:

- `docs/SPRINT.md`
- `docs/SPRINT_ARCHIVE.md`
- `docs/WORKLOG.md`
- `docs/CANONICAL_REPORT.md`
- historical audit files in `docs/`

