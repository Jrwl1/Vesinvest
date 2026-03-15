# Agent contract

This file is the repository OS contract.

## Mode Router (strict)

1. Read the user's first non-empty line.
2. If that line starts with exactly `PLAN`, run the PLAN protocol.
3. If that line starts with exactly `DO`, run the DO protocol.
4. If that line starts with exactly `RUNSPRINT`, run the RUNSPRINT entry behavior.
5. If that line starts with exactly `REVIEW`, run the REVIEW protocol.
6. Otherwise, treat the message as normal chat (no protocol). Answer normally. Do not edit any files and do not run repo actions unless the user explicitly asks.

## Continuous execution policy (default)

- Do not require extra user prompts between DO and REVIEW.
- When a run enters via `DO` or `RUNSPRINT`, execute continuous internal cycles as substep-driven DO with row-gated REVIEW: `DO -> (REVIEW only when the selected sprint row becomes READY) -> DO`.
- DO owns substep-level implementation, hygiene, and evidence capture. REVIEW owns row-level acceptance verification only.
- Auto-REVIEW must not run after every substep. It runs only when the selected sprint row has all substeps checked and `Status=READY`.
- Continue the loop until one of these is true:
  1. all active sprint rows are `DONE`, or
  2. a DO/REVIEW stop condition is hit, or
  3. a blocker is recorded per protocol.
- Each internal DO/REVIEW cycle must still fully obey its own read/write permissions, commit rules, and `docs/WORKLOG.md` one-line append rule.
- Standalone `REVIEW` command remains valid and runs the REVIEW protocol directly.

## RUNSPRINT entry behavior

- `RUNSPRINT` is an explicit whole-sprint execution entry.
- It uses the DO protocol, the same row-gated DO/REVIEW loop engine, and the same implementation subagent policy.
- It starts from the first active sprint row with `Status != DONE` and its first unchecked substep.
- For each selected substep, the parent agent may delegate implementation work to one implementation subagent, then must complete the DO protocol itself. If that DO run makes the current row `READY`, the parent must run REVIEW before moving on. Otherwise it proceeds directly to the next DO selection.
- It continues until all active sprint rows are `DONE` or a blocker/stop condition is hit.
- `DO` remains valid and unchanged.

## Global rules

- Preserve each file's current language. Do not translate entire files.
- Tool/agent instructions must be written in ENGLISH.
- Subagents are execution helpers only. The parent agent remains responsible for protocol compliance, scope control, evidence quality, commit creation, and stop-condition handling.
- `delegate_autopilot` is an allowed launcher for the existing subagent policies in this contract. It is not a new protocol mode and does not change mode routing.
- Any `delegate_autopilot` run must preserve this contract's scope, clean-tree, and commit rules.
- WORKLOG read limit: only the last ~30 lines.
- Never create parallel planning systems.
- Do not use subagents or `delegate_autopilot` to create parallel planning systems, parallel sprint execution streams, or recursive delegation. Delegated agents must not call further `delegate_*` tools.
- `docs/WORKLOG.md` is append-only.
- `docs/DECISIONS.md` is append-only.
- Protocol clean-tree checks use `git status --porcelain` as the authority.
- Ignored local files are outside protocol scope and do not count as dirt.
- Tracked changes and untracked non-ignored files do count as dirt.
- Any artifacts or logs created by `delegate_autopilot` must be written outside the repository worktree, or only to ignored paths that do not appear in `git status --porcelain`.
- `DO` and `REVIEW` still must end with an absolutely clean working tree when their protocol says so.
- `PLAN` may start from a dirty working tree. Pre-existing dirt does not block PLAN by itself.
- `PLAN` must not stage or commit unrelated pre-existing changes unless the user explicitly asks for that.
- Blocker taxonomy is strict: use `HARD BLOCKED:` for scope, forbidden-touch, commit-structure, or clean-tree failures; use `GATE BLOCKED:` for required verification failures that cannot be resolved within the bounded same-package gate-fix rule.

## React Rules of Hooks

When editing React components:

- **Hooks must run in the same order every render.** Do not place hooks (useState, useMemo, useCallback, useEffect, etc.) after conditional early returns. If a component has `if (loading) return ...` or `if (foo) return ...`, all hooks must be declared _before_ any such return.
- **Violation symptom:** White screen, "Rendered fewer hooks than expected" or "Rendered more hooks than during the previous render" in console.
- **Fix:** Move any hook that appears after an early return to before the first conditional return.

## File caps and schema

| File                     | Hard rule                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `docs/SPRINT.md`         | Variable-length active queue. No questions. Each row must include: `ID`, `Do`, `Files`, `Acceptance`, `Evidence`, `Stop`, `Status`. |
| `docs/PROJECT_STATUS.md` | Max 60 lines. Must remain a short snapshot.                                                                                   |
| `docs/WORKLOG.md`        | Append exactly one line per run (PLAN/DO/REVIEW).                                                                             |
| `docs/DECISIONS.md`      | Append ADR entries only when a real decision is made.                                                                         |

Sprint `Status` enum is strict: `TODO | IN_PROGRESS | READY | DONE`.

## PLAN protocol

### REQUIRED READS (in order)

1. `docs/CANONICAL.md`
2. `AGENTS.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/ROADMAP.md`
5. `docs/SPRINT.md`
6. `docs/BACKLOG.md`
7. `docs/DECISIONS.md` (if present)
8. `docs/WORKLOG.md` (last ~30 lines only)
9. `docs/client/**` (if present)
10. Skim docs referenced by the canonical set.

### RESEARCH SUBAGENT POLICY

- The parent agent must personally complete the PLAN required reads in order. Research subagents may assist only with follow-up context gathering and must not substitute for the parent's required canonical reads.
- After the parent agent personally completes the PLAN required reads in order, the parent may use `delegate_autopilot` for read-only follow-up research only.
- PLAN may use read-only research subagents to gather context from docs, code, configs, and referenced materials relevant to planning.
- Research subagents and any PLAN `delegate_autopilot` run must not write repository files, stage changes, create commits, or produce alternative planning artifacts.
- The parent agent must synthesize all PLAN outputs itself and remains solely responsible for the final PLAN doc updates and PLAN commit.
- Research subagents should report concise findings, relevant file paths, risks, and open questions back to the parent agent for synthesis.

### ALLOWED WRITES

- `docs/ROADMAP.md`
- `docs/BACKLOG.md`
- `docs/SPRINT.md`
- `docs/PROJECT_STATUS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/DECISIONS.md` (append-only)
- `docs/WORKLOG.md` (append exactly one PLAN line)
- `AGENTS.md` (only when user explicitly requests OS contract hardening)

### FORBIDDEN TOUCH

- `apps/**`
- `packages/**`
- `prisma/**`
- `**/migrations/**`
- Any file not listed in ALLOWED WRITES.

### REQUIRED OUTPUTS

PLAN must produce:

1. Updated `docs/ROADMAP.md` (milestones + done criteria)
2. Updated `docs/BACKLOG.md` (structured tasks)
3. Updated `docs/SPRINT.md`
4. Updated `docs/PROJECT_STATUS.md` (short snapshot)
5. Updated `docs/CANONICAL_REPORT.md` (changes + conflict resolution)
6. Optional `docs/DECISIONS.md` ADR append(s) when needed
7. Exactly one PLAN line in `docs/WORKLOG.md`

### WORKLOG format

`- [HH:MM] PLAN: <one-line summary> (sprint: S-xx..S-yy, milestone: Mx)`

### Completion

- PLAN must end with a single commit containing all PLAN doc updates.
- PLAN completion is evaluated against the pre-PLAN `git status --porcelain` baseline, not absolute tree emptiness.
- If PLAN started with a clean working tree, it must end clean after the PLAN commit.
- If PLAN started dirty, the PLAN commit must contain only allowed PLAN write files, and any remaining dirty entries after the PLAN commit must already have existed before PLAN started unless the user explicitly asked to commit them too.

### STOP CONDITIONS

- If requirement is unknown: write `TBD (Owner: Customer)` in `docs/BACKLOG.md` and a blocker in `docs/PROJECT_STATUS.md`, then stop.
- If a hard cap would be exceeded: stop and report the cap violation.
- If sources conflict and cannot be resolved by canonical order: record in `docs/CANONICAL_REPORT.md` and stop.
- If PLAN cannot isolate its allowed doc changes from overlapping pre-existing dirt in the same file without also committing unrelated edits, stop and report.

## DO protocol

### REQUIRED READS

- `docs/CANONICAL.md`
- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/WORKLOG.md` (last ~30 lines only)
- Code files needed for the selected unchecked sprint substep.

### ALLOWED WRITES

- Product-scope files explicitly listed in the selected sprint substep `files:` scope, including code, config, env examples, and non-canonical repo docs
- Minimal same-package gate-fix files allowed by the DO gate-fix exception after a required `run:` command fails
- `docs/SPRINT.md` (status/evidence updates)
- `docs/BACKLOG.md` (newly discovered tasks)
- `docs/WORKLOG.md` (append exactly one DO line)

### FORBIDDEN TOUCH

- `docs/ROADMAP.md`
- `docs/PROJECT_STATUS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/DECISIONS.md`
- `AGENTS.md`

### IMPLEMENTATION SUBAGENT POLICY

- After selecting the current substep deterministically, DO may delegate that one substep to one implementation subagent.
- After the parent agent selects the current substep deterministically, the parent may use `delegate_autopilot` once for that selected substep only.
- The parent agent remains solely responsible for substep selection, scope enforcement, command verification, commit creation, evidence updates, worklog updates, and clean-tree validation.
- An implementation subagent or delegated `delegate_autopilot` run may inspect and modify only files within the selected substep's `files:` scope, plus any minimal same-package gate-fix files the parent explicitly authorizes after a required `run:` command fails.
- An implementation subagent or delegated `delegate_autopilot` run must not update `docs/SPRINT.md`, `docs/BACKLOG.md`, or `docs/WORKLOG.md`, and must not stage changes or create protocol commits.
- The implementation subagent or delegated `delegate_autopilot` run must report back changed files, commands run, results, and blockers before the parent agent proceeds.
- DO must never execute multiple sprint substeps in parallel, whether directly or through subagents or `delegate_autopilot`.

### EXECUTION RULES

- `docs/SPRINT.md` `Do` checklists must stay flat; each row may include as many substeps as needed, and each substep must be small enough to complete in one DO run.
- Select work deterministically:
  1. Pick the first sprint row with `Status != DONE`.
  2. Inside that row, pick the first unchecked substep that starts with `- [ ]`.
  3. Execute only that one substep.
- Do not pull new scope from outside `docs/SPRINT.md`.
- If a substep adds or tightens a new test, parity, lint, typecheck, schema, or contract gate, its `files:` scope must include both the gate file(s) and the likely same-package implementation or consumer files that could need edits if that gate exposes drift.
- Before editing, record the DO baseline with `git status --porcelain`.
- DO may start from a dirty baseline only when every pre-existing dirty path matches the selected substep `files:` scope and the agent can safely explain those changes as part of the selected substep. Those paths may be absorbed into the product commit. If any pre-existing dirty path falls outside scope, DO must stop with `HARD BLOCKED: dirty baseline outside files-scope`. If overlapping in-scope dirt cannot be safely isolated or explained, DO must stop with `HARD BLOCKED: dirty baseline not safely absorbable`.
- If a required `run:` command fails, DO may use a bounded same-package gate-fix exception: edit the minimal additional files in the same workspace package needed to make that required run pass. Same-package means the workspace targeted by the failed required run, or, if the run is package-agnostic, the workspace that owns the selected substep `files:` scope. Cross-package fallout remains a hard blocker and must be added to backlog before stopping.
- Before the product commit, run a hygiene check using `git status --porcelain` plus path inspection. Classify every dirty path as selected-scope, bounded same-package gate-fix, or out-of-scope. If any tracked dirty path is outside those allowed buckets, DO must stop with `HARD BLOCKED: hygiene check scope mismatch`.
- If a selected substep explicitly lists non-canonical repo docs or config examples in its `files:` scope (for example `README.md`, `DEPLOYMENT.md`, or `.env.example`), DO may edit them as product-scope files. Canonical planning docs and `AGENTS.md` remain forbidden unless this section says otherwise.
- DO must finish with a clean working tree (`git status --porcelain` empty). When DO updates docs, use a 2-commit pattern so the docs commit is last and the tree is clean for REVIEW.
- **Two commits:**
  - **Product commit** (code/config only). Message: `do(S-XX): <substep summary>`.
  - **Docs commit** (`docs/SPRINT.md`, `docs/WORKLOG.md`, `docs/BACKLOG.md` only). Message: `docs(S-XX): evidence update`. Make the docs commit last so the working tree remains clean.
- A substep may be marked `- [x]` ONLY if all are true:
  1. Relevant changes are staged (`git add ...`).
  2. The substep `run:` command(s) have been executed (or explicitly `N/A` only when the substep text allows it).
  3. A product commit exists for that substep.
  4. If DO modified docs, a docs commit exists; then working tree is clean AFTER the docs commit (`git status --porcelain` is empty). If DO did not modify docs, working tree is clean after the product commit.
  5. The **product** commit includes changes in the substep's `files:` scope (verify via `git show --name-only <product_hash>`; at least one changed path must match the substep's listed paths/globs).
- The substep `evidence:` line MUST use: `commit:<product_hash> | run:<cmd> -> <result> | files:<paths from git show --name-only <product_hash>> | docs:<docs_hash or N/A> | status: clean`.
- When DO absorbs an in-scope dirty baseline or uses the same-package gate-fix exception, append `| baseline:absorbed` and/or `| gate-fix:<paths>` before `| status: clean`.
- **BLOCKED behavior:** If after the docs commit (or after the product commit when no docs were modified) the tree is dirty, DO must:
  - Write `HARD BLOCKED: dirty working tree` in that substep's `evidence:` line.
  - NOT check the box (`- [x]`).
  - Append exactly one DO worklog line.
  - STOP.
- If a required `run:` command fails and cannot be resolved within the bounded same-package gate-fix exception, DO must write `GATE BLOCKED: <reason>` in that substep's `evidence:` line, NOT check the box, append exactly one DO worklog line, and STOP.
- **Clean tree for DO/REVIEW:** A clean tree means `git status --porcelain` is empty. Ignored local files do not appear in this check and do not block protocol runs. Tracked changes and untracked non-ignored files do block protocol runs. If the tree is dirty due to forbidden-file changes (e.g. `docs/PROJECT_STATUS.md`), the user should discard or commit those outside DO (e.g. `git restore docs/PROJECT_STATUS.md`) so the tree is clean before the next DO or REVIEW.
- If the product commit does not include any change within the substep's `files:` scope, DO must write `HARD BLOCKED: commit missing files-scope` in that substep's `evidence:` line, NOT check the box, append one DO worklog line, and STOP.
- If product commit is missing, DO must STOP and write: `HARD BLOCKED: commit missing (commit-per-substep required)` in that substep `evidence:` line, and DO must NOT check the box.
- Optionally keep the row `Evidence` cell as a short status pointer only.
- Mark the executed substep as `- [x]` only after its `run:` command and `evidence:` update are completed.
- If a row is `TODO` and the first substep becomes `- [x]`, set row `Status=IN_PROGRESS`.
- Set row `Status=READY` only when all substeps in the selected row are `- [x]` and each checked substep `evidence:` line contains `commit` + `run` + `files`.
- DO may set row status only `TODO -> IN_PROGRESS` and `IN_PROGRESS -> READY`; DO must never set `DONE`.

### WORKLOG format

`- [HH:MM] DO: <one-line summary> (sprint: S-xx, links: <commit or file paths>)`

### STOP CONDITIONS

- If blocked: write `HARD BLOCKED:` or `GATE BLOCKED:` in the sprint row, append one DO worklog line, then stop.
- If task requires scope change beyond the bounded same-package gate-fix rule: add task to backlog and stop.

## REVIEW protocol

### REQUIRED READS

- `docs/CANONICAL.md`
- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md` (if present)
- `docs/WORKLOG.md` (last ~30 lines only)
- Relevant code evidence for sprint acceptance checks.
- Working tree state via read-only `git status` / `git diff` when evidence validation needs it.

### ALLOWED WRITES

- `docs/SPRINT.md` (Evidence/Status updates only; no row/substep rewrites)
- `docs/PROJECT_STATUS.md`
- `docs/BACKLOG.md`
- `docs/CANONICAL_REPORT.md`
- `docs/WORKLOG.md` (append exactly one REVIEW line)

### FORBIDDEN TOUCH

- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/CANONICAL.md`
- `AGENTS.md`
- Product code files
- Sprint table structure and `Do` substep content in `docs/SPRINT.md`

### REVIEW SUBAGENT POLICY

- `delegate_autopilot` is not used in REVIEW unless a future ADR explicitly defines a read-only review-helper policy.

### REVIEW OUTPUT RULES

- Verify sprint Evidence against Acceptance criteria.
- Treat sprint rows with `Status=READY` as eligible for acceptance verification.
- REVIEW is an acceptance gate, not a per-substep checkpoint. In-progress row checks stay inside DO and must not create standalone REVIEW pass noise.
- REVIEW may read product code and use read-only verification commands; REVIEW must not write product code.
- If Evidence is missing for a `TODO` sprint item, write `Evidence needed` and continue review.
- If working tree is dirty, report finding as `Working tree dirty: <file list>` and continue review using current state.
- If commit hash evidence is not available due to uncommitted work, accept temporary evidence as `uncommitted: <git diff summary or file list>; commit hash pending`.
- REVIEW must not rewrite sprint IDs, sprint structure, Acceptance text, or `Do` substeps.
- REVIEW may only update sprint `Evidence` and sprint `Status`, plus backlog items for confirmed scope gaps.
- REVIEW may set `Status=DONE` only from `Status=READY` (never from `TODO` or `IN_PROGRESS`).
- REVIEW may set `Status=DONE` only when:
  1. Acceptance is satisfied.
  2. Evidence for the row includes commit hash and test output or artifact path.
- If row `Status != READY`, do not mark `DONE`. Do not write routine `Not eligible (status != READY)` noise to sprint evidence. Only record a finding if there is a real structural problem, scope drift, or missing evidence that needs action.
- If acceptance fails or evidence is insufficient, keep `Status=READY` (or set `IN_PROGRESS` only if more DO work is required) and write missing evidence in the row `Evidence` cell.
- Continue with structural checks even when Evidence is missing: sprint format, scope boundaries, forbidden-touch compliance, and planning drift. For non-READY rows, these checks are secondary and should not be turned into acceptance-pass bookkeeping.
- Report findings first, ordered by severity.
- Update status/backlog only when drift or evidence state is verified.
- If REVIEW is invoked and no sprint row is `READY`, the outcome is `SKIP`, not `PASS`. In that case REVIEW must not create a `review: evidence update` commit and must not write placeholder acceptance text into `docs/SPRINT.md`.
- A REVIEW run is considered `PASS` only when at least one `READY` sprint row was actually evaluated for acceptance, no blocker/stop condition is triggered, and all intended review doc updates are complete.
- When REVIEW is `PASS`, stage and commit the REVIEW doc updates in one docs-only commit containing only allowed REVIEW write files (`docs/SPRINT.md`, `docs/PROJECT_STATUS.md`, `docs/BACKLOG.md`, `docs/CANONICAL_REPORT.md`, `docs/WORKLOG.md`).
- REVIEW pass commit message must be: `review: evidence update`.
- After the REVIEW pass commit, `git status --porcelain` must be empty. If not empty, record finding `BLOCKED: dirty working tree after REVIEW pass commit` and stop.

### WORKLOG format

`- [HH:MM] REVIEW: <one-line summary> (findings: <brief>)`

### STOP CONDITIONS

- Pre-existing dirty working tree is allowed during REVIEW checks, but REVIEW cannot be reported as `PASS` unless the tree is clean at the end.
- For REVIEW clean-tree purposes, `git status --porcelain` is authoritative; ignored local files are out of scope, but tracked changes and untracked non-ignored files still count as dirty.
- If completing REVIEW would require modifying forbidden files (including product code), stop and report.
- If forbidden file edits are made during the REVIEW run (review-caused writes), stop.
- If scope violations are detected, stop.
- If contradictions in canonical hierarchy are detected, stop.
- If REVIEW `PASS` commit cannot be created or working tree cannot be made clean, stop and report blocker.
