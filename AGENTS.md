# Agent contract

This file is the repository OS contract.

## Mode Router (strict)

1. Read the user's first non-empty line.
2. If a `HUMANAUDIT` session is already active and that line contains the standalone uppercase phrase `OK GO` anywhere, run the HUMANAUDIT freeze behavior.
3. If a `HUMANAUDIT` session is already active and that line contains the standalone uppercase token `CANCEL` anywhere, end the HUMANAUDIT session with no repo writes and return to normal chat.
4. If a `HUMANAUDIT` session is already active and that line contains any standalone uppercase token `PLAN`, `DO`, `RUNSPRINT`, or `REVIEW`, end the HUMANAUDIT session and run that protocol instead.
5. If a `HUMANAUDIT` session is already active, continue the HUMANAUDIT protocol for the new message even if no protocol token is present.
6. If that line contains the standalone uppercase token `HUMANAUDIT` anywhere, run the HUMANAUDIT protocol.
7. If that line contains the standalone uppercase token `PLAN` anywhere, run the PLAN protocol.
8. If that line contains the standalone uppercase token `DO` anywhere, run the DO protocol.
9. If that line contains the standalone uppercase token `RUNSPRINT` anywhere, run the RUNSPRINT entry behavior.
10. If that line contains the standalone uppercase token `REVIEW` anywhere, run the REVIEW protocol.
11. Otherwise, treat the message as normal chat (no protocol). Answer normally. Do not edit any files and do not run repo actions unless the user explicitly asks.

## Continuous execution policy (default)

- Do not require extra user prompts between DO and REVIEW.
- When a run enters via `DO` or `RUNSPRINT`, execute continuous internal cycles as packet-driven DO with row-gated REVIEW: `DO packet -> (REVIEW only when the selected sprint row becomes READY) -> DO packet`.
- DO owns packet-level implementation, hygiene, and evidence capture. REVIEW owns row-level acceptance verification only.
- Auto-REVIEW must not run after every substep. It runs only when the selected sprint row has all substeps checked and `Status=READY`.
- Under `RUNSPRINT`, `READY` is only a row gate, not a sprint-stop state. Keep selecting the next unfinished row/substep after each eligible REVIEW until every active row has no unchecked substeps left and has been carried through REVIEW to `DONE`.
- Under `RUNSPRINT`, packet-level blockers are execution inputs, not sprint-stop events. Fix them when possible, document them when they occur, and continue the whole-sprint loop instead of ending the run because one row or packet hit friction.
- Continue the loop until one of these is true:
  1. all active sprint rows are `DONE`, or
  2. a truly global impossibility is recorded after compliant remediation attempts, and no further sprint row or packet can be executed.
- Each internal DO/REVIEW cycle must still fully obey its own read/write permissions, commit rules, and `docs/WORKLOG.md` one-line append rule.
- Standalone `REVIEW` command remains valid and runs the REVIEW protocol directly.

## RUNSPRINT entry behavior

- `RUNSPRINT` is an explicit whole-sprint execution entry.
- It uses the DO protocol, the same row-gated DO/REVIEW loop engine, and the same implementation subagent policy.
- It starts from the first active sprint row with `Status != DONE` and its first unchecked substep.
- For each active row packet, the parent agent acts as the orchestrator. It may launch native helper agents, complete the DO protocol itself, and then run REVIEW only if that DO packet makes the row `READY`.
- One `RUNSPRINT` is expected to carry the active sprint all the way through every remaining row, step, and substep until each active row reaches `DONE`.
- It must not stop after one row, one packet, one blocker, or one `READY` transition.
- When a DO packet or REVIEW pass reports a blocker inside `RUNSPRINT`, that blocker does not end the overall `RUNSPRINT` by itself. The orchestrator must attempt the allowed fix path first, record the blocker and any remediation in sprint/backlog/worklog evidence, and then continue with the next executable packet or row.
- A DO or REVIEW stop condition inside `RUNSPRINT` stops only that packet or review pass unless it creates a global impossibility that leaves no compliant executable work anywhere else in the active sprint.
- Blockers discovered during `RUNSPRINT` must be both documented in-repo and mentioned in the final user-facing chat summary, including whether they were fixed during the run or remain as residual follow-up.
- `DO` remains valid and unchanged.

## Shared enforcement

### Global rules

- Preserve each file's current language. Do not translate entire files.
- Tool/agent instructions must be written in ENGLISH.
- Frontend copy freeze is strict:
  - Do not add new user-facing copy unless the user explicitly asks for new copy, or the exact new string already exists in accepted repo copy for the same feature.
  - If the user points at specific bad strings, only change those strings unless one adjacent string must change for grammar or locale parity.
  - Prefer deletion over replacement, and replacement over invention.
  - Do not add explanatory/helper/trust/body copy just to fill visual space or make a screen feel more complete.
  - Screenshots and live UI evidence beat pattern-completion. Empty space is acceptable; unrequested copy is not.
  - If a proposed frontend fix would require inventing a new visible string that is not explicitly requested and not already established in accepted repo copy, stop and ask instead of inventing it.
- The main sprint-running agent is the orchestrator. Native helper agents (`default`, `explorer`, `worker`) are execution helpers only. The parent agent remains responsible for protocol compliance, scope control, evidence quality, commit creation, and stop-condition handling.
- Model routing is a runtime concern, not a protocol guarantee. When the runtime exposes model controls, prefer `gpt-5.4` with `high` for the orchestrator and any parent-led big-read or big-work pass; prefer `gpt-5.4-mini` with `high` for `worker` and `explorer` helpers; use `default` helpers only when broader synthesis is worth the heavier model, and prefer `gpt-5.4` with `high` when that heavier helper is needed. When the runtime does not expose model controls, keep orchestration in the parent and do not assume exact helper model identity.
- Use direct MCP tools when they materially help the task: `filesystem` for repo inspection, `git` for evidence, `github` for PR or CI context, `context7` for current dependency docs, and `chrome-devtools` or `playwright` for browser verification.
- Do not use external delegation or autopilot tooling in this repo. Native helper agents defined by this contract are allowed only within the bounded policies below.
- Parent-first execution bias: default to doing the work in the parent agent. Use helper agents only when they create a clear wall-clock win and the work can be split without adding coordination overhead or protocol risk.
- WORKLOG read limit: only the last ~30 lines.
- Never create parallel planning systems.
- Do not use helper agents to create parallel planning systems, parallel sprint execution streams, or recursive orchestration trees. Helper agents must not launch new helper graphs unless the parent explicitly delegates orchestration itself.
- Parallel helper work is allowed only inside one active sprint row and only inside one active DO packet at a time.
- `docs/WORKLOG.md` is append-only.
- `docs/DECISIONS.md` is append-only.
- Protocol clean-tree checks use `git status --porcelain` as the authority.
- Ignored local files are outside protocol scope and do not count as dirt.
- Temporary Markdown scratch files are outside protocol scope only when they are untracked, their basename starts with `tmp_` or `temp_`, and they are ignored so they do not appear in `git status --porcelain`.
- Tracked changes and untracked non-ignored files do count as dirt.
- Any artifacts or logs created by helper-agent tooling must be written outside the repository worktree, or only to ignored paths that do not appear in `git status --porcelain`.
- Local service lifecycle is conservative: if a frontend, API, or other required local app is already reachable, reuse it. Do not run port-clearing commands, kill listeners, restart local dev servers, or otherwise disrupt existing user-run services unless there is a verified need and either the user explicitly asked for it or the current task cannot proceed without it.
- Helper lifecycle is strict: the parent must not leave packet-scoped helper agents running across packet boundaries, commit boundaries, or into REVIEW. Before any packet commit, docs commit, REVIEW pass, or next-packet selection, the parent must first wait for every helper launched for the active packet to reach a final state. Explicit interrupt/close is exception-only and may be used only when the helper is hung, no longer needed, or would otherwise violate shared-worktree safety. After helper completion or shutdown, re-run `git status --porcelain`.
- `DO` and `REVIEW` must end with an absolutely clean working tree when their protocol says so.
- `PLAN` may start from a dirty working tree. Pre-existing dirt does not block PLAN by itself.
- `PLAN` must not stage or commit unrelated pre-existing changes unless the user explicitly asks for that.
- Blocker taxonomy is strict:
  - use `HARD BLOCKED:` for scope, forbidden-touch, commit-structure, or clean-tree failures
  - use `GATE BLOCKED:` for required verification failures that cannot be resolved within the bounded same-package gate-fix rule

### React Rules of Hooks

- Hooks must run in the same order every render.
- Do not place hooks (`useState`, `useMemo`, `useCallback`, `useEffect`, etc.) after conditional early returns.
- Violation symptom: white screen, `Rendered fewer hooks than expected`, or `Rendered more hooks than during the previous render`.
- Fix: move any hook that appears after an early return to before the first conditional return.

### File caps and schema

| File                     | Hard rule                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `docs/SPRINT.md`         | Variable-length active queue. No questions. Each row must include: `ID`, `Do`, `Files`, `Acceptance`, `Evidence`, `Stop`, `Status`. |
| `docs/SPRINT_ARCHIVE.md` | Historical sprint rows and condensed execution history only. Not part of default protocol reads.                              |
| `docs/PROJECT_STATUS.md` | Max 60 lines. Must remain a short snapshot.                                                                                   |
| `docs/BACKLOG_ARCHIVE.md`| Historical accepted backlog/epic history only. Not part of default protocol reads.                                            |
| `docs/WORKLOG.md`        | Append exactly one line per run (`PLAN`/`DO`/`REVIEW` only; `HUMANAUDIT` is read-only and does not write worklog).          |
| `docs/DECISIONS.md`      | Append ADR entries only when a real decision is made.                                                                         |

Sprint `Status` enum is strict: `TODO | IN_PROGRESS | READY | DONE`.

- In `docs/SPRINT.md`, `Files` is a blast-radius contract, not a precise edit inventory.
- `docs/SPRINT.md` is active-only. Move completed or superseded rows out of the active queue instead of keeping a long in-place history.
- `docs/BACKLOG.md` is open-work only. Move accepted historical summaries out of the main backlog instead of using it as a second archive.
- Prefer area scopes/globs over exact file lists when work spans auth/session, browser automation, test harnesses, dependency or config changes, CI/workflow changes, or coordinated frontend/backend slices.
- Use exact file lists only when the change surface is truly isolated and low-blast-radius.

## HUMANAUDIT protocol

### Purpose

- `HUMANAUDIT` is a session-scoped, read-only intake protocol for screenshot-led or text-led product audits.
- The parent agent remains the orchestrator, receives evidence over multiple user messages, maps it to likely frontend/backend code, and builds context until the user sends `OK GO`, `CANCEL`, or an explicit protocol-switch token.
- `OK GO` freezes intake and produces a synthesized fix/implementation plan in chat only. It does not write repo docs or code. A later `PLAN` run may materialize that plan into canonical planning docs and `docs/SPRINT.md`.
- `CANCEL` ends the active `HUMANAUDIT` session with no repo writes.

### Required reads

- `docs/CANONICAL.md`
- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/WORKLOG.md` (last ~30 lines only)
- Code, config, and supporting docs needed to localize the reported issue

### Allowed writes

- None inside the repository

### Forbidden touch

- All repository files are write-forbidden during `HUMANAUDIT`, including `AGENTS.md`, canonical docs, product code, and non-canonical docs.
- No staging, committing, branch manipulation, or other git state changes.
- No sprint-row edits, backlog edits, worklog lines, ADR appends, or scratch planning files inside the repository.

### Intake and localization rules

- Maintain one rolling in-memory audit summary across the active session. Merge related screenshots/messages under likely shared root causes instead of creating a new issue record for every fragment.
- Each active audit item should track:
  - observed behavior
  - expected behavior
  - repro context
  - likely frontend files
  - likely backend files
  - confidence
  - open unknowns
  - likely acceptance check
- Default to parent-led intake.
- Use read-only `explorer` helpers only when new evidence materially changes the code-localization problem or when distinct frontend/backend localization questions can be answered in parallel.
- Do not spawn a new helper for every small follow-up if the likely code area is already known.
- HUMANAUDIT helpers are read-only. They must not write repo files, stage changes, create commits, or generate parallel planning artifacts.
- When evidence is insufficient, ask for the next most useful screenshot, text, console error, network trace, or repro detail instead of guessing.
- Keep a rolling compressed summary in chat so early evidence stays usable during longer sessions.

### OK GO behavior

- When the user sends `OK GO` inside an active `HUMANAUDIT` session, freeze intake, merge duplicates by likely root cause, and synthesize the findings into a fix/implementation plan in chat only.
- The `OK GO` synthesis must include grouped findings, suspected frontend/backend ownership, open risks or unknowns, and proposed sprint-row shape with candidate acceptance checks and blast-radius `files:` scopes.
- `OK GO` does not write `docs/SPRINT.md`, `docs/BACKLOG.md`, or any other repo file.
- Only a later `PLAN` run may write the synthesized plan into canonical planning docs.

### Completion

- `HUMANAUDIT` stays active across user messages until `OK GO`, `CANCEL`, or an explicit switch to another protocol via the Mode Router.
- `HUMANAUDIT` is read-only and does not append a `docs/WORKLOG.md` line.

### Stop conditions

- If safe code localization is not yet possible, stop at an evidence request rather than pretending certainty.
- If the user asks for implementation or repo writes before `PLAN`, stop and redirect the flow to `PLAN` or another explicit write-capable protocol.
- If another protocol token is given on the first line, `HUMANAUDIT` ends and the new protocol takes over per the Mode Router.

## PLAN protocol

### Required reads (in order)

1. `docs/CANONICAL.md`
2. `AGENTS.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/ROADMAP.md`
5. `docs/SPRINT.md`
6. `docs/BACKLOG.md`
7. `docs/DECISIONS.md` (if present)
8. `docs/WORKLOG.md` (last ~30 lines only)
9. Skim docs referenced by the canonical set.

Customer-source documents under `docs/client/**` are not a default PLAN required read.
Only read them during PLAN when the user explicitly names which document(s) to use for that specific pass.

### Research subagent policy

- The parent agent must personally complete the PLAN required reads in order.
- Research subagents may assist only with follow-up context gathering and must not substitute for the parent's required canonical reads.
- After the parent agent personally completes the PLAN required reads in order, the parent may launch native read-only helper agents for follow-up research only when that context gathering is clearly parallelizable and not on the critical path.
- PLAN may use read-only research subagents to gather context from docs, code, configs, and referenced materials relevant to planning.
- Research subagents must not write repository files, stage changes, create commits, or produce alternative planning artifacts.
- The parent agent must synthesize all PLAN outputs itself and remains solely responsible for the final PLAN doc updates and PLAN commit.
- Research subagents should report concise findings, relevant file paths, risks, and open questions back to the parent agent for synthesis.
- If PLAN follows a `HUMANAUDIT` session that ended with `OK GO`, the planner may use that finalized intake synthesis as supplemental planning input after completing the required canonical reads. HUMANAUDIT context never overrides canonical order or code reality.

### Allowed writes

- `docs/ROADMAP.md`
- `docs/BACKLOG.md`
- `docs/BACKLOG_ARCHIVE.md`
- `docs/SPRINT.md`
- `docs/SPRINT_ARCHIVE.md`
- `docs/PROJECT_STATUS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/DECISIONS.md` (append-only)
- `docs/WORKLOG.md` (append exactly one PLAN line)
- `AGENTS.md` (only when user explicitly requests OS contract hardening)

### Forbidden touch

- `apps/**`
- `packages/**`
- `prisma/**`
- `**/migrations/**`
- Any file not listed in allowed writes

### Required outputs

PLAN must produce:

1. Updated `docs/ROADMAP.md` (milestones + done criteria)
2. Updated `docs/BACKLOG.md` (structured tasks)
3. Updated `docs/SPRINT.md`
4. Updated `docs/PROJECT_STATUS.md` (short snapshot)
5. Updated `docs/CANONICAL_REPORT.md` (changes + conflict resolution)
6. Optional `docs/DECISIONS.md` ADR append(s) when needed
7. Exactly one PLAN line in `docs/WORKLOG.md`

### Worklog format

`- [HH:MM] PLAN: <one-line summary> (sprint: S-xx..S-yy, milestone: Mx)`

### Completion

- PLAN must end with a single commit containing all PLAN doc updates.
- PLAN completion is evaluated against the pre-PLAN `git status --porcelain` baseline, not absolute tree emptiness.
- If PLAN started with a clean working tree, it must end clean after the PLAN commit.
- If PLAN started dirty, the PLAN commit must contain only allowed PLAN write files, and any remaining dirty entries after the PLAN commit must already have existed before PLAN started unless the user explicitly asked to commit them too.

### Stop conditions

- If requirement is unknown: write `TBD (Owner: Customer)` in `docs/BACKLOG.md` and a blocker in `docs/PROJECT_STATUS.md`, then stop.
- If a hard cap would be exceeded: stop and report the cap violation.
- If sources conflict and cannot be resolved by canonical order: record in `docs/CANONICAL_REPORT.md` and stop.
- If PLAN cannot isolate its allowed doc changes from overlapping pre-existing dirt in the same file without also committing unrelated edits, stop and report.

## DO protocol

### Required reads

- `docs/CANONICAL.md`
- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/WORKLOG.md` (last ~30 lines only)
- Code files needed for the selected active DO packet

### Allowed writes

- Product-scope files explicitly listed in the selected active DO packet `files:` scopes, including code, config, env examples, and non-canonical repo docs
- Minimal same-package gate-fix files allowed by the DO gate-fix exception after a required `run:` command fails
- `docs/SPRINT.md` (status/evidence updates)
- `docs/BACKLOG.md` (newly discovered tasks)
- `docs/WORKLOG.md` (append exactly one DO line)

### Forbidden touch

- `docs/ROADMAP.md`
- `docs/PROJECT_STATUS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/DECISIONS.md`
- `AGENTS.md`

### Implementation subagent policy

- After selecting the current sprint row and active DO packet deterministically, the parent may launch native helper agents: `explorer` for read-only scanning, `worker` for bounded implementation, and `default` only when broader synthesis is needed.
- Prefer the parent agent for small or tightly coupled packets; use helpers only when there is a clear speedup.
- The parent agent remains solely responsible for packet selection, scope enforcement, command verification, commit creation, evidence updates, worklog updates, and clean-tree validation.
- The active DO packet may contain the adjacent unchecked substeps from the same row that share one coherent verification boundary and one coherent scope boundary. Split the packet at the next clear verification change or scope break.
- Helper agents may read across the active row, but write access is limited to the active packet `files:` scopes, plus any minimal same-package gate-fix files the parent explicitly authorizes after a required `run:` command fails.
- Helper agents must not update `docs/SPRINT.md`, `docs/BACKLOG.md`, or `docs/WORKLOG.md`, and must not stage changes or create protocol commits.
- The parent may run helpers in parallel inside the active packet only when their write scopes do not overlap. Parallel work across multiple sprint rows or multiple DO packets is forbidden.
- After helper work for the active packet finishes, control returns to the parent agent. The parent must complete verification, staging, commit creation, docs updates, worklog append, and clean-tree validation before selecting the next packet.
- Helper agents must report back changed files, commands run, results, and blockers for the active packet before the parent agent proceeds.
- Before staging, before the packet commit, before the docs commit, and before any auto-REVIEW transition, the parent must wait for every helper launched for the active packet to finish and then re-check `git status --porcelain`. Explicit interrupt/close is allowed only as an exception when the helper is hung, no longer needed, or would otherwise violate shared-worktree safety. If new tracked dirt appears after helper completion or exception shutdown, treat it as part of the active packet only if it is still in scope and can be safely absorbed; otherwise stop.

### Execution rules

- `docs/SPRINT.md` `Do` checklists must stay flat; each row may include as many substeps as needed, and each substep must be small enough to complete in one DO run.
- The row `Files` field is the expected blast radius for the row. Prefer area scopes such as `apps/web/src/**`, `apps/api/src/**`, `packages/**`, `test/**`, workspace config, and lockfiles when the work crosses UI/API/test/config seams; do not pretend a cross-cutting row can be safely modeled as one exact file list.
- When a DO packet edits visible frontend text or locale files, the parent must treat copy scope as explicit product scope:
  1. remove or rewrite only the strings required by the active substep or explicit user direction
  2. do not add any new helper/body/trust/explanatory copy unless the sprint row explicitly calls for it
  3. if a new visible string seems necessary but is not explicitly requested and not already established in accepted repo copy, stop and ask instead of inventing it
- Select work deterministically:
  1. Pick the first sprint row with `Status != DONE`.
  2. Inside that row, start from the first unchecked substep that starts with `- [ ]`.
  3. Build one active DO packet containing that substep and the next adjacent unchecked substeps in the same row only while they share the same verification command set or verification boundary and stay inside one coherent scope boundary.
  4. Execute only that one packet.
- Do not pull new scope from outside `docs/SPRINT.md`.
- Certain same-area collateral files are implicitly in scope when their trigger area is in scope: `pnpm-lock.yaml` with root or workspace `package.json`; same-workspace `vitest*`, `playwright*`, lint/typecheck/test config, and `test/**` for browser/test-harness work; directly coupled auth/session client/server/context/route/test files for auth/session work; and required non-canonical operational or security notes for workflow or sensitive-config changes. Implicit collateral scope is still same-area only and does not authorize cross-feature expansion.
- If a substep adds or tightens a new test, parity, lint, typecheck, schema, or contract gate, its `files:` scope must include both the gate file(s) and the likely same-package implementation or consumer files that could need edits if that gate exposes drift.
- If a substep exposes, edits, or persists a specific product field through UI/API flow, its `files:` scope must include the directly coupled contract files for that field (for example DTOs, API client types, backend service/controller files, and the matching tests).
- Before editing, record the DO baseline with `git status --porcelain`.
- DO may start from a dirty baseline only when every pre-existing dirty path matches the active packet `files:` scopes and the agent can safely explain those changes as part of that packet.
- If any pre-existing dirty path falls outside scope, DO must stop with `HARD BLOCKED: dirty baseline outside files-scope`.
- If overlapping in-scope dirt cannot be safely isolated or explained, DO must stop with `HARD BLOCKED: dirty baseline not safely absorbable`.
- If a required `run:` command fails, DO may use a bounded same-package gate-fix exception: edit the minimal additional files in the same workspace package needed to make that required run pass. Same-package means the workspace targeted by the failed required run, or, if the run is package-agnostic, the workspace that owns the active packet `files:` scopes. Cross-package fallout remains a hard blocker and must be added to backlog before stopping.
- If a selected packet cannot truthfully implement its explicitly stated behavior only because the sprint `files:` scope omitted minimal same-area collateral or directly coupled contract files, DO may use a bounded same-row scope-widen exception: update `docs/SPRINT.md` once per active row before continuing, add only the smallest same-area support, lockfile, config, contract, consumer, or test files required, keep the change inside the same feature slice, and persist that scope update in the active packet commit or the row docs commit. Broad cross-feature expansion remains blocked.
- Before the packet commit, run a hygiene check using `git status --porcelain` plus path inspection. Classify every dirty path as active-packet scope, bounded same-package gate-fix, or out-of-scope. If any tracked dirty path is outside those allowed buckets, DO must stop with `HARD BLOCKED: hygiene check scope mismatch`.
- If a selected packet substep explicitly lists non-canonical repo docs or config examples in its `files:` scope, DO may edit them as product-scope files. Canonical planning docs and `AGENTS.md` remain forbidden unless this section says otherwise.
- DO must finish with a clean working tree (`git status --porcelain` empty) at packet boundaries.
- Commit pattern:
  - Packet commit. Required for every successful packet. Message: `do(S-XX): <packet summary>`. The packet commit must include the packet's product work and may also include packet-local `docs/SPRINT.md` and `docs/WORKLOG.md` progress updates when the row remains `IN_PROGRESS`.
  - Row docs commit. Message: `docs(S-XX): evidence update`. Required only when the row becomes `READY`, when DO stops on a blocker, or when docs-only scope/backlog updates must land after the packet commit. It may include only `docs/SPRINT.md`, `docs/WORKLOG.md`, and `docs/BACKLOG.md`.
- A substep may be marked `- [x]` as part of a completed packet only if all are true:
  1. relevant changes are staged
  2. the packet's required `run:` command(s) have been executed, or explicitly `N/A` only when the substep text allows it
  3. a packet commit exists for that packet
  4. if the packet triggers a required row docs commit, that docs commit exists and the tree is clean after it; otherwise the tree is clean after the packet commit
  5. the packet commit includes changes in the active packet `files:` scopes
- Each checked substep in the packet must have an `evidence:` line. The line must use:
  `packet:<packet_hash> | run:<cmd or command-set> -> <result> | files:<paths from git show --name-only <packet_hash>> | docs:<docs_hash or packet_hash or N/A> | status: clean`
- Use the packet hash in `docs:` when the packet commit itself carries the packet-local sprint/worklog updates and no separate docs commit exists.
- The same evidence line may be reused across all substeps completed in the same packet when they share the same commits and verification.
- When DO absorbs an in-scope dirty baseline or uses the same-package gate-fix exception, append `| baseline:absorbed` and/or `| gate-fix:<paths>` before `| status: clean`.
- If after the required row docs commit, or after the packet commit when no separate docs commit is required, the tree is dirty, DO must:
  - write `HARD BLOCKED: dirty working tree` in the first unfinished substep's `evidence:` line for the active packet
  - not check any unfinished substeps in that packet
  - append exactly one DO worklog line
  - stop
- If a required `run:` command fails and cannot be resolved within the bounded same-package gate-fix exception, DO must:
  - write `GATE BLOCKED: <reason>` in the first unfinished substep's `evidence:` line for the active packet
  - not check any unfinished substeps in that packet
  - append exactly one DO worklog line
  - stop
- Clean tree for DO/REVIEW means `git status --porcelain` is empty. Ignored local files do not appear in this check and do not block protocol runs. Temporary Markdown scratch files qualify only when they follow the repo ignore convention (`tmp_*.md` or `temp_*.md` anywhere in the worktree). Tracked changes and untracked non-ignored files do block protocol runs.
- If the packet commit does not include any change within the active packet `files:` scopes, DO must write `HARD BLOCKED: commit missing files-scope` in the first unfinished substep's `evidence:` line for that packet, not check any unfinished substeps in that packet, append one DO worklog line, and stop.
- If the packet commit is missing, DO must stop and write `HARD BLOCKED: commit missing (commit-per-packet required)` in the first unfinished substep's `evidence:` line for that packet.
- Optionally keep the row `Evidence` cell as a short status pointer only.
- Mark the executed substeps as `- [x]` only after the packet's `run:` command(s), commits, and `evidence:` updates are completed.
- If a row is `TODO` and the first packet completes at least one substep, set row `Status=IN_PROGRESS`.
- Set row `Status=READY` only when all substeps in the selected row are `- [x]` and each checked substep `evidence:` line contains `packet` + `run` + `files`.
- DO may set row status only `TODO -> IN_PROGRESS` and `IN_PROGRESS -> READY`; DO must never set `DONE`.

### Worklog format

`- [HH:MM] DO: <one-line summary> (sprint: S-xx, links: <commit or file paths>)`

### Stop conditions

- If blocked: write `HARD BLOCKED:` or `GATE BLOCKED:` in the sprint row, append one DO worklog line, then stop.
- If task requires scope change beyond the bounded same-row scope-widen or same-package gate-fix rules: add task to backlog and stop.

## REVIEW protocol

### Required reads

- `docs/CANONICAL.md`
- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md` (if present)
- `docs/WORKLOG.md` (last ~30 lines only)
- Relevant code evidence for sprint acceptance checks
- Working tree state via read-only `git status` or `git diff` when evidence validation needs it

### Allowed writes

- `docs/SPRINT.md` (Evidence/Status updates only; no row/substep rewrites)
- `docs/PROJECT_STATUS.md`
- `docs/BACKLOG.md`
- `docs/CANONICAL_REPORT.md`
- `docs/WORKLOG.md` (append exactly one REVIEW line)

### Forbidden touch

- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/CANONICAL.md`
- `AGENTS.md`
- Product code files
- Sprint table structure and `Do` substep content in `docs/SPRINT.md`

### Review subagent policy

- REVIEW remains parent-led unless a future ADR explicitly defines a read-only review-helper policy.
- REVIEW may start only after the parent has waited for all helpers from the preceding DO packet to reach a final state, or has explicitly interrupted or closed them under the exception rule above, and has then re-checked `git status --porcelain`.
- REVIEW may start only after the parent confirms that no helper agent from the preceding DO packet is still running and the post-helper `git status --porcelain` check has been performed.

### Review output rules

- Verify sprint Evidence against Acceptance criteria.
- Treat sprint rows with `Status=READY` as eligible for acceptance verification.
- REVIEW is an acceptance gate, not a per-substep checkpoint. In-progress row checks stay inside DO and must not create standalone REVIEW pass noise.
- REVIEW may read product code and use read-only verification commands; REVIEW must not write product code.
- If Evidence is missing for a `TODO` sprint item, write `Evidence needed` and continue review.
- If working tree is dirty, report finding as `Working tree dirty: <file list>` and continue review using current state.
- If commit hash evidence is not available due to uncommitted work, accept temporary evidence as `uncommitted: <git diff summary or file list>; commit hash pending`.
- REVIEW must not rewrite sprint IDs, sprint structure, Acceptance text, or `Do` substeps.
- REVIEW may only update sprint `Evidence` and sprint `Status`, plus backlog items for confirmed scope gaps.
- REVIEW may set `Status=DONE` only from `Status=READY`.
- REVIEW may set `Status=DONE` only when:
  1. acceptance is satisfied
  2. evidence for the row includes commit hash and test output or artifact path
- If row `Status != READY`, do not mark `DONE`. Do not write routine `Not eligible (status != READY)` noise to sprint evidence. Only record a finding if there is a real structural problem, scope drift, or missing evidence that needs action.
- If acceptance fails or evidence is insufficient, keep `Status=READY`, or set `IN_PROGRESS` only if more DO work is required, and write missing evidence in the row `Evidence` cell.
- Continue with structural checks even when Evidence is missing: sprint format, scope boundaries, forbidden-touch compliance, and planning drift. For non-READY rows, these checks are secondary and should not be turned into acceptance-pass bookkeeping.
- Report findings first, ordered by severity.
- Update status/backlog only when drift or evidence state is verified.
- If REVIEW is invoked and no sprint row is `READY`, the outcome is `SKIP`, not `PASS`. In that case REVIEW must not create a `review: evidence update` commit and must not write placeholder acceptance text into `docs/SPRINT.md`.
- A REVIEW run is considered `PASS` only when at least one `READY` sprint row was actually evaluated for acceptance, no blocker or stop condition is triggered, and all intended review doc updates are complete.
- When REVIEW is `PASS`, stage and commit the REVIEW doc updates in one docs-only commit containing only allowed REVIEW write files.
- REVIEW pass commit message must be: `review: evidence update`.
- After the REVIEW pass commit, `git status --porcelain` must be empty. If not empty, record finding `BLOCKED: dirty working tree after REVIEW pass commit` and stop.

### Worklog format

`- [HH:MM] REVIEW: <one-line summary> (findings: <brief>)`

### Stop conditions

- Pre-existing dirty working tree is allowed during REVIEW checks, but REVIEW cannot be reported as `PASS` unless the tree is clean at the end.
- For REVIEW clean-tree purposes, `git status --porcelain` is authoritative; ignored local files are out of scope, temporary Markdown scratch files qualify only when they follow the repo ignore convention (`tmp_*.md` or `temp_*.md` anywhere in the worktree), but tracked changes and untracked non-ignored files still count as dirty.
- If completing REVIEW would require modifying forbidden files, including product code, stop and report.
- If forbidden file edits are made during the REVIEW run, stop.
- If scope violations are detected, stop.
- If contradictions in canonical hierarchy are detected, stop.
- If REVIEW `PASS` commit cannot be created or the working tree cannot be made clean, stop and report blocker.
