# Agent Map

This file is the short entry point for agents working in this repository. It is a map, not an operating system.

## Start Here

- Repository index: `docs/index.md`
- Product truth: `docs/product/index.md`
- Architecture map: `docs/architecture/index.md`
- Quality gates: `docs/quality/index.md`
- Local harness: `docs/harness/index.md`
- Active execution plans: `docs/exec-plans/active/`
- Completed execution plans: `docs/exec-plans/completed/`
- Generated repository maps: `docs/generated/index.md`

## Default Loop

1. Understand the user request and identify the smallest relevant product or engineering area.
2. Read `docs/index.md`, then follow only the links needed for the task.
3. Inspect the code, tests, config, and generated maps that prove the current behavior.
4. Make the smallest coherent change.
5. Run the narrowest sufficient verification command from `docs/quality/gates.md`.
6. Capture evidence in the execution plan or final response.

## Planning

- Use lightweight in-chat plans for small changes.
- Use a checked-in execution plan for multi-step work, cross-layer changes, migrations, audits, or work that needs durable evidence.
- Active plans live in `docs/exec-plans/active/`.
- Completed plans move to `docs/exec-plans/completed/`.
- Use `docs/exec-plans/templates/feature.md`, `bugfix.md`, or `audit.md` as the starting shape.

## Repository Knowledge

- Repository-local markdown, code, schemas, tests, scripts, and generated maps are the source of truth available to agents.
- Prefer indexed docs over historical audit files.
- Historical docs remain traceability references, not default context.
- If docs and code disagree about current behavior, inspect code and update the relevant indexed doc or execution plan.

## Mechanical Gates

- `pnpm check:harness` validates the agent map, docs indexes, and execution-plan shape.
- `pnpm check:harness:strict` also runs the existing repo-health rules.
- `pnpm check:repo-health` validates file caps, thin facades, and dependency boundaries.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and focused package commands remain the implementation gates.
- Architecture and taste rules should be promoted into scripts, lint rules, dependency-cruiser rules, tests, or generated checks instead of expanding this file.

## Local Harness

- Boot local development with `pnpm dev` unless a narrower package command is enough.
- Browser and journey validation are documented in `docs/harness/browser-validation.md`.
- Runtime signals and logging expectations are documented in `docs/harness/observability.md`.
- Do not kill or restart user-run local services unless the task requires it and the current service state is verified.

## Agent Boundaries

- Preserve each file's current language.
- Keep user-facing copy changes narrowly scoped and backed by existing product language unless the user explicitly asks for new copy.
- Avoid unrelated refactors and metadata churn.
- Do not revert user changes.
- Use helper agents only for bounded work that clearly improves wall-clock time without creating coordination risk.

## Retired Protocols

The former AIOS commands (`HUMANAUDIT`, `PLAN`, `RUNSPRINT`, `DO`, `OK GO`, and `CANCEL`) are retired. They are historical terminology only and do not route agent behavior.
