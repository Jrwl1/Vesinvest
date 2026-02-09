# Sprint

Active work items (max 5). This is what gets executed when the user says **"do"**.
Items are drawn from [BACKLOG.md](BACKLOG.md) and aligned with [ROADMAP.md](ROADMAP.md).

When a task is DONE, Evidence must include a commit hash or file diff reference and (if applicable) test command output.

| ID | Task | Status | Done when | Evidence |
|----|------|--------|-----------|----------|
| S-01 | Verify all API tests pass (`pnpm test`) | TODO | Exit code 0, no failures | Terminal output |
| S-02 | Verify `pnpm lint` and `pnpm typecheck` pass clean | TODO | Exit code 0 | Terminal output |
| S-03 | Update TESTING.md test suite table to list current spec files | TODO | Table matches files on disk | `docs/TESTING.md` vs `**/*.spec.ts` glob |
| S-04 | Fix DEPLOYMENT.md: remove "Asset Maintenance" and stale auto-login refs | TODO | No references to old naming or removed behaviour | `DEPLOYMENT.md` diff |
