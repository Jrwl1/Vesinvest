# CI Harness

CI should enforce repository structure and provide fast feedback to agents.

## Workflows

- Main CI: `../../.github/workflows/ci.yml`
- Repo health: `../../.github/workflows/repo-health.yml`

## Local Equivalents

```bash
pnpm check:harness
pnpm check:harness:strict
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Prefer focused package commands during implementation, then run broader commands only when the change surface justifies them.
