# Local Development Harness

## Standard Boot

```bash
pnpm dev
```

This starts the API first, waits for readiness, then starts the web app.

## Narrow Boots

```bash
pnpm --filter ./apps/api dev
pnpm --filter ./apps/web dev
```

Use narrow boots when the task only needs one package.

## Service Rules

- Reuse an already reachable local service when possible.
- Do not kill or restart user-run services unless the task requires it and the current state has been verified.
- Capture the URL, route, account state, and command output used for manual validation.

