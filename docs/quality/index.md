# Quality Index

Use this page to choose the narrowest sufficient verification command for a change.

## Primary Gates

- Gate catalog: `gates.md`
- CI workflow: `../../.github/workflows/ci.yml`
- Repo-health workflow: `../../.github/workflows/repo-health.yml`
- Testing guide: `../../TESTING.md`
- Deployment gates: `../../DEPLOYMENT.md`

## Default Verification Order

1. Run the nearest unit or component test for the changed behavior.
2. Run the package typecheck when TypeScript contracts changed.
3. Run the package lint when imports, hooks, or formatting-sensitive code changed.
4. Run focused smoke or Playwright journeys for route, workflow, or browser behavior.
5. Run broad gates only when the change affects shared contracts, release readiness, or multiple packages.

