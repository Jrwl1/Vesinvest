# Harness Migration

## Goal

Replace the former AIOS command protocol with harness-engineering defaults: a short agent map, indexed repository knowledge, execution-plan artifacts, and mechanical checks.

## Context Links

- `AGENTS.md`
- `docs/index.md`
- `docs/harness/index.md`
- `docs/quality/gates.md`

## Files / Blast Radius

- Root agent and README docs
- Canonical/status/roadmap/sprint pointer docs
- New indexed docs under `docs/product`, `docs/architecture`, `docs/quality`, `docs/harness`, `docs/exec-plans`, and `docs/generated`
- New harness check scripts under `scripts/`
- Root `package.json` scripts

## Acceptance

- `AGENTS.md` is a short map, not a protocol runtime.
- AIOS command routing is retired in canonical docs.
- New execution-plan directories and templates exist.
- `pnpm check:harness` passes.
- Legacy repo-health remains available separately as `pnpm check:harness:strict`.

## Verification

```bash
pnpm check:harness
```

## Progress Log

- Replaced `AGENTS.md` with a short harness map.
- Added indexed docs and execution-plan templates.
- Repointed canonical/status/roadmap/sprint docs at the harness model.
- Added `check:agent-map`, `check:docs-index`, `check:exec-plans`, `check:harness`, and `check:harness:strict`.

## Decisions

- Split `check:harness` from `check:harness:strict` because current repo-health file caps fail on pre-existing product files outside this migration.

## Evidence

- `pnpm check:harness` -> pass.
- `pnpm check:harness:strict` currently reaches repo-health and fails on pre-existing file-cap debt.

