# Sprint

Window: 2026-03-20 to 2026-06-20

Active execution queue only. Execute top-to-bottom.
Accepted rows are intentionally removed from this file once they are no longer active.
Use `docs/SPRINT_ARCHIVE.md` for condensed historical sprint context and `docs/WORKLOG.md`, `docs/CANONICAL_REPORT.md`, and git history for packet/review evidence.
Protocol authority remains `AGENTS.md`.

Execution notes:
- `DO` and `RUNSPRINT` still follow packet-driven execution with row-gated `REVIEW`.
- Cleanliness is always `git status --porcelain`.
- Use direct MCP tools when they materially improve evidence or verification quality.
- Frontend copy rule: delete or rewrite only the strings required by the active row or explicit user direction; do not invent filler/helper/trust/body copy.
- Client-doc rule: customer files under `docs/client/**` are not default PLAN reads; only use them when the user explicitly names them for that pass.

Required substep shape:
- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` or `N/A` only when the substep text explicitly allows it
- `  - evidence: packet:<hash> | run:<cmd> -> <result> | files:<paths> | docs:<hash or N/A> | status: clean`

## Goal (this sprint)

Keep the active queue truthful and minimal while the only unfinished row is the deployment-side security/performance hold `S-156`.

## Recorded decisions (this sprint)

- This file is now active-only; accepted history has been trimmed out of the execution queue.
- Historical rows now live in `docs/SPRINT_ARCHIVE.md` instead of being kept inline in the active queue.
- `S-156` remains the only unfinished row and is a deployment-only header-verification hold.
- No further local frontend execution row remains active. Any new UI issue must re-enter through `HUMANAUDIT -> OK GO -> PLAN` before implementation.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
| --- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-156 | Re-run focused regressions, production build checks, and a live security/performance audit after remediation. See S-156 substeps. | apps/web/src/**, apps/api/src/**, docs/SECURITY_PERFORMANCE_REAUDIT.md, package.json | Focused automated regressions, production build output, header verification, and a fresh live browser audit prove the queue removed the audit findings without workflow drift, or record the remaining blocker precisely. | row:cc4230ee1e5e1c7a5d0e21e3fb67f0565b4ac9ec \| run:pnpm security-perf:reaudit && pnpm release-check && curl.exe -I https://vesipolku.jrwl.io && curl.exe -I https://api.jrwl.io/health/live -> PASS \| files:docs/SECURITY_PERFORMANCE_REAUDIT.md \| docs:pending-review \| status: clean | Stop if the re-audit still exposes a security or performance gap outside `S-149..S-155`; record the blocker and stop there. | READY |

### S-156 substeps

- [x] Run the focused automated regression bundle after the security/performance fixes land
  - files: apps/web/src/**, apps/api/src/**, package.json
  - run: pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts src/v2/v2.service.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:a133713e36f45a2e5f3a76ca5c65bbbb7a09e401 | run:pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts src/v2/v2.service.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:package.json | docs:N/A | status: clean

- [x] Record a fresh live security/performance re-audit with build output, header checks, browser network/console proof, and any residual blockers
  - files: docs/SECURITY_PERFORMANCE_REAUDIT.md, apps/web/src/**, apps/api/src/**
  - run: N/A (manual browser audit plus build/header verification allowed)
  - evidence: packet:6eef7a43a126f183c2486060d9e1a97d52e57860 | run:N/A (manual browser audit plus build/header verification allowed) -> PASS with residual blockers recorded in docs/SECURITY_PERFORMANCE_REAUDIT.md | files:docs/SECURITY_PERFORMANCE_REAUDIT.md | docs:N/A | status: clean
