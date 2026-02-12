# Agent contract

This file is the repository OS contract.

## Mode Router (strict)

1. Read the user's first non-empty line.
2. If that line starts with exactly `PLAN`, run the PLAN protocol.
3. If that line starts with exactly `DO`, run the DO protocol.
4. If that line starts with exactly `REVIEW`, run the REVIEW protocol.
5. Otherwise, treat the message as normal chat (no protocol). Answer normally. Do not edit any files and do not run repo actions unless the user explicitly asks.

## Global rules

- Preserve each file's current language. Do not translate entire files.
- Tool/agent instructions must be written in ENGLISH.
- WORKLOG read limit: only the last ~30 lines.
- Never create parallel planning systems.
- `docs/WORKLOG.md` is append-only.
- `docs/DECISIONS.md` is append-only.

## React Rules of Hooks

When editing React components:

- **Hooks must run in the same order every render.** Do not place hooks (useState, useMemo, useCallback, useEffect, etc.) after conditional early returns. If a component has `if (loading) return ...` or `if (foo) return ...`, all hooks must be declared *before* any such return.
- **Violation symptom:** White screen, "Rendered fewer hooks than expected" or "Rendered more hooks than during the previous render" in console.
- **Fix:** Move any hook that appears after an early return to before the first conditional return.

## File caps and schema

| File | Hard rule |
|---|---|
| `docs/SPRINT.md` | Exactly 5 active items. No questions. Each row must include: `ID`, `Do`, `Files`, `Acceptance`, `Evidence`, `Stop`, `Status`. |
| `docs/PROJECT_STATUS.md` | Max 60 lines. Must remain a short snapshot. |
| `docs/WORKLOG.md` | Append exactly one line per run (PLAN/DO/REVIEW). |
| `docs/DECISIONS.md` | Append ADR entries only when a real decision is made. |

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
- PLAN must end with a single commit containing all PLAN doc updates and a clean working tree (`git status --porcelain` empty after the commit).

### STOP CONDITIONS
- If requirement is unknown: write `TBD (Owner: Customer)` in `docs/BACKLOG.md` and a blocker in `docs/PROJECT_STATUS.md`, then stop.
- If a hard cap would be exceeded: stop and report the cap violation.
- If sources conflict and cannot be resolved by canonical order: record in `docs/CANONICAL_REPORT.md` and stop.

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
- Code files required by the selected sprint substep
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

### EXECUTION RULES
- `docs/SPRINT.md` `Do` checklists must stay flat; each row may include as many substeps as needed, and each substep must be small enough to complete in one DO run.
- Select work deterministically:
  1. Pick the first sprint row with `Status != DONE`.
  2. Inside that row, pick the first unchecked substep that starts with `- [ ]`.
  3. Execute only that one substep.
- Do not pull new scope from outside `docs/SPRINT.md`.
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
- **BLOCKED behavior:** If after the docs commit (or after the product commit when no docs were modified) the tree is dirty, DO must:
  - Write `BLOCKED: dirty working tree` in that substep's `evidence:` line.
  - NOT check the box (`- [x]`).
  - Append exactly one DO worklog line.
  - STOP.
- **Clean tree for DO/REVIEW:** If the tree is dirty only due to forbidden-file changes (e.g. `docs/PROJECT_STATUS.md`), the user should discard or commit those outside DO (e.g. `git restore docs/PROJECT_STATUS.md`) so the tree is clean before the next DO or REVIEW.
- If the product commit does not include any change within the substep's `files:` scope, DO must write `BLOCKED: commit missing files-scope` in that substep's `evidence:` line, NOT check the box, append one DO worklog line, and STOP.
- If product commit is missing, DO must STOP and write: `BLOCKED: commit missing (commit-per-substep required)` in that substep `evidence:` line, and DO must NOT check the box.
- Optionally keep the row `Evidence` cell as a short status pointer only.
- Mark the executed substep as `- [x]` only after its `run:` command and `evidence:` update are completed.
- If a row is `TODO` and the first substep becomes `- [x]`, set row `Status=IN_PROGRESS`.
- Set row `Status=READY` only when all substeps in the selected row are `- [x]` and each checked substep `evidence:` line contains `commit` + `run` + `files`.
- DO may set row status only `TODO -> IN_PROGRESS` and `IN_PROGRESS -> READY`; DO must never set `DONE`.

### WORKLOG format
`- [HH:MM] DO: <one-line summary> (sprint: S-xx, links: <commit or file paths>)`

### STOP CONDITIONS
- If blocked: write blocker in the sprint row, append one DO worklog line, then stop.
- If task requires scope change: add task to backlog and stop.

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

### REVIEW OUTPUT RULES
- Verify sprint Evidence against Acceptance criteria.
- Treat sprint rows with `Status=READY` as eligible for acceptance verification.
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
- If row `Status != READY`, do not mark `DONE`; write `Not eligible (status != READY)` or `Evidence needed` and continue structural checks.
- If acceptance fails or evidence is insufficient, keep `Status=READY` (or set `IN_PROGRESS` only if more DO work is required) and write missing evidence in the row `Evidence` cell.
- Continue with structural checks even when Evidence is missing: sprint format, scope boundaries, forbidden-touch compliance, and planning drift.
- Report findings first, ordered by severity.
- Update status/backlog only when drift or evidence state is verified.
- A REVIEW run is considered `PASS` only when no blocker/stop condition is triggered and all intended review doc updates are complete.
- When REVIEW is `PASS`, stage and commit the REVIEW doc updates in one docs-only commit containing only allowed REVIEW write files (`docs/SPRINT.md`, `docs/PROJECT_STATUS.md`, `docs/BACKLOG.md`, `docs/CANONICAL_REPORT.md`, `docs/WORKLOG.md`).
- REVIEW pass commit message must be: `review: evidence update`.
- After the REVIEW pass commit, `git status --porcelain` must be empty. If not empty, record finding `BLOCKED: dirty working tree after REVIEW pass commit` and stop.

### WORKLOG format
`- [HH:MM] REVIEW: <one-line summary> (findings: <brief>)`

### STOP CONDITIONS
- Pre-existing dirty working tree is allowed during REVIEW checks, but REVIEW cannot be reported as `PASS` unless the tree is clean at the end.
- If completing REVIEW would require modifying forbidden files (including product code), stop and report.
- If forbidden file edits are made during the REVIEW run (review-caused writes), stop.
- If scope violations are detected, stop.
- If contradictions in canonical hierarchy are detected, stop.
- If REVIEW `PASS` commit cannot be created or working tree cannot be made clean, stop and report blocker.
