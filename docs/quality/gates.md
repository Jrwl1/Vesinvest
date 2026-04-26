# Quality Gates

Choose the smallest command set that proves the change.

## Repository Harness

```bash
pnpm check:harness
```

Validates the agent map, docs indexes, and execution-plan shape.

```bash
pnpm check:harness:strict
```

Also runs existing repo-health checks.

## Existing Repo Health

```bash
pnpm check:repo-health
```

Runs file caps, thin-facade checks, and dependency boundary checks.

## Package Gates

```bash
pnpm --filter ./apps/web test -- <spec>
pnpm --filter ./apps/web typecheck
pnpm --filter ./apps/web lint

pnpm --filter ./apps/api test -- <spec>
pnpm --filter ./apps/api typecheck
pnpm --filter ./apps/api lint
```

## Broader Gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm smoke:v2
pnpm build
```

Use broad gates when shared contracts, build output, or release readiness may have changed.
