# Sprint

Window: 2026-03-20 to 2026-06-20

Active execution queue only. Execute top-to-bottom.
Accepted rows are intentionally removed from this file once they are no longer active.
Use `docs/SPRINT_ARCHIVE.md` for condensed historical sprint context and `docs/WORKLOG.md`, `docs/CANONICAL_REPORT.md`, and git history for historical evidence.
Protocol authority remains `AGENTS.md`.

Execution notes:
- `DO` and `RUNSPRINT` follow row-driven execution with row-gated `REVIEW`.
- Cleanliness is always `git status --porcelain`.
- Use direct MCP tools when they materially improve evidence or verification quality.
- Frontend copy rule: delete or rewrite only the strings required by the active row or explicit user direction; do not invent filler/helper/trust/body copy.
- Client-doc rule: customer files under `docs/client/**` are not default PLAN reads; only use them when the user explicitly names them for that pass.

Required substep shape:
- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>`, `covered by row-end bundle -> <command(s)>`, or `N/A` only when the substep text explicitly allows it
- `  - evidence: row:<hash> | run:<cmd> -> <result> | files:<paths> | docs:<hash or N/A> | status: clean`

## Goal (this sprint)

Correct the login hero hierarchy on unauthenticated entry so the brand leads and the redundant intro sentence is gone.

## Recorded decisions (this sprint)

- `S-157..S-167` remain done and belong in `docs/SPRINT_ARCHIVE.md`, not the active queue.
- `S-168` is the only active row in this file.
- The unauthenticated loading/error hero in `apps/web/src/App.tsx` is part of the same login-entry surface and is in scope for this row.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
| --- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-168 | Make `Vesipolku` the sole large hero heading on unauthenticated entry and remove the redundant intro sentence above the three existing point boxes. See S-168 substeps. | apps/web/src/App.tsx, apps/web/src/components/LoginForm.tsx, apps/web/src/App.css, apps/web/src/**/*.test.tsx | Fresh unauthenticated open shows one large blue `Vesipolku` heading, `Suunnittele vesilaitoksen taloutta` and `Tuo VEETI-tiedot, korjaukset ja ennuste samaan työnkulkuun.` are absent from the login surface, the three existing point boxes stay intact, and the loading/error auth entry does not flash the removed hero copy. | row:67be07ecf2c32b606c22cd3f2858a2cf1404eeae \| run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck; pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck -> PASS \| files:apps/web/src/App.css, apps/web/src/App.tsx, apps/web/src/components/LoginForm.test.tsx, apps/web/src/components/LoginForm.tsx, apps/web/vitest.config.ts \| docs:N/A \| gate-fix:apps/web/vitest.config.ts \| status: clean | Stop if truthful login-entry cleanup requires inventing new visible copy or widening into invite/legal acceptance flows instead of the current unauthenticated login surface. | DONE |

### S-168 substeps

- [x] Promote `Vesipolku` to the only large hero heading on the login screen and delete the redundant body sentence while preserving the existing three point boxes
  - files: apps/web/src/components/LoginForm.tsx, apps/web/src/App.css, apps/web/src/components/LoginForm.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: row:67be07ecf2c32b606c22cd3f2858a2cf1404eeae | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.css, apps/web/src/components/LoginForm.test.tsx, apps/web/src/components/LoginForm.tsx | docs:N/A | status: clean

- [x] Align the auth loading/error hero with the same login-entry hierarchy so the removed copy does not flash before the login card loads
  - files: apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/**/*.test.tsx
  - run: pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: row:67be07ecf2c32b606c22cd3f2858a2cf1404eeae | run:pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.css, apps/web/src/App.tsx, apps/web/src/components/LoginForm.test.tsx, apps/web/src/components/LoginForm.tsx, apps/web/vitest.config.ts | docs:N/A | gate-fix:apps/web/vitest.config.ts | status: clean
