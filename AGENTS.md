# Agent contract

This file is the repository OS contract.

## Mode Router

1. Read the user's first non-empty line and trim leading whitespace.
2. A protocol command is recognized only when that line starts with one of these exact commands: `HUMANAUDIT`, `PLAN`, `RUNSPRINT`, legacy `DO`, `OK GO`, `CANCEL`.
3. The command may be followed by end-of-line, `:`, or whitespace.
4. Do not route on protocol words that appear later in the line or inside longer phrases.
5. `DO` is retired. If the line starts with `DO`, treat it as `RUNSPRINT`.
6. `REVIEW` is retired as a user-facing protocol. Review now happens inside `RUNSPRINT` as row acceptance.
7. If a `HUMANAUDIT` session is active and the command is `OK GO`, run the HUMANAUDIT freeze behavior.
8. If a `HUMANAUDIT` session is active and the command is `CANCEL`, end the HUMANAUDIT session with no repo writes and return to normal chat.
9. If a `HUMANAUDIT` session is active and the command is `PLAN` or `RUNSPRINT`, end the HUMANAUDIT session and run that protocol instead.
10. If a `HUMANAUDIT` session is active and no new command is present, continue HUMANAUDIT.
11. If the command is `HUMANAUDIT`, `PLAN`, `RUNSPRINT`, or legacy `DO`, run that protocol.
12. Otherwise, treat the message as normal chat. Do not edit repo files unless the user explicitly asks.

## Core Model

- User-facing modes are `HUMANAUDIT`, `PLAN`, and `RUNSPRINT`.
- `HUMANAUDIT` is read-only intake.
- `PLAN` updates canonical docs and the active sprint queue.
- `RUNSPRINT` executes sprint rows end to end.
- Row acceptance is internal to `RUNSPRINT`. There is no separate review protocol for normal operation.
- `RUNSPRINT` continues until every active row is `DONE` or `BLOCKED`, or a truly global impossibility leaves no compliant executable work.

## Shared Enforcement

### Global rules

- Preserve each file's current language. Do not translate entire files.
- Tool and agent instructions must be written in English.
- `AGENTS.md` is the only normative source for protocol behavior. Other docs may summarize it but must not restate narrower or conflicting protocol rules.
- `docs/BACKLOG.md` is a user-owned optional parking lot, not a default execution input.
- `docs/WORKLOG.md` is append-only.
- `docs/DECISIONS.md` is append-only.
- Protocol clean-tree checks use `git status --porcelain` as the authority.
- Ignored local files are outside protocol scope and do not count as dirt.
- Temporary Markdown scratch files are outside protocol scope only when they are untracked, ignored, and their basename starts with `tmp_` or `temp_`.
- Tracked changes and untracked non-ignored files do count as dirt.
- Never create parallel planning systems.
- Do not use helper agents to create recursive helper graphs or parallel sprint streams.
- Parent-first execution bias applies. Use helper agents only when they provide a clear wall-clock win without creating coordination risk.
- Parallel helper work is allowed only inside one active sprint row at a time.
- Helper artifacts must be written outside the repo or only to ignored paths that do not appear in `git status --porcelain`.
- Local service lifecycle is conservative: reuse an already reachable local service. Do not kill listeners or restart user-run services unless the task requires it and there is a verified need.
- When helper agents are used, the parent must wait for all row-scoped helpers to finish before any commit, scope repair, or next-row selection.

### Frontend copy freeze

- Do not add new user-facing copy unless the user explicitly asks for it, or the exact string already exists in accepted repo copy for the same feature.
- If the user points at specific bad strings, change only those strings unless one adjacent string must change for grammar or locale parity.
- Prefer deletion over replacement, and replacement over invention.
- Do not add explanatory, helper, trust, or body copy just to fill space.
- If a frontend fix would require inventing a new visible string that is not explicitly requested and not already established in accepted repo copy, stop and ask instead of inventing it.

### Verification minimization

- Choose the narrowest sufficient verification set for the active row.
- Prefer package-local and surface-local commands over broad bundles.
- Add or expand automated tests only when the row changes logic, contracts, persisted state rules, auth or security behavior, parser or transform behavior, or fixes a regression that lacks stable coverage.
- Do not create new automated tests for copy-only or CSS-only changes unless acceptance explicitly requires automation or no nearby test can guard the regression.

### React rules of hooks

- Hooks must run in the same order every render.
- Do not place hooks after a conditional early return.
- The common failure symptom is `Rendered fewer hooks than expected` or `Rendered more hooks than during the previous render`.

### File caps and schema

| File | Hard rule |
| --- | --- |
| `docs/SPRINT.md` | Active queue only. Each row must include `ID`, `Do`, `Files`, `Acceptance`, `Evidence`, `Stop`, `Status`. |
| `docs/SPRINT_ARCHIVE.md` | Historical rows only. Not part of default execution reads. |
| `docs/PROJECT_STATUS.md` | Max 60 lines. Keep it as a short snapshot. |
| `docs/BACKLOG.md` | Optional future-task parking lot. Not part of default reads. |
| `docs/BACKLOG_ARCHIVE.md` | Historical backlog only. |
| `docs/WORKLOG.md` | Append one line per PLAN run and one line per completed or blocked RUNSPRINT row. |
| `docs/DECISIONS.md` | Append ADR entries only when a real decision is made. |

- Sprint `Status` enum is strict: `TODO | IN_PROGRESS | BLOCKED | DONE`.
- In `docs/SPRINT.md`, `Files` is a blast-radius contract, not a precise edit inventory.
- Prefer area scopes and globs over exact file lists when more than one layer is plausibly involved.
- Use exact file lists only when the change surface is truly isolated.

## HUMANAUDIT

### Purpose

- `HUMANAUDIT` is a session-scoped, read-only intake protocol for screenshot-led or text-led product audits.
- The parent agent remains the orchestrator, receives evidence over multiple user messages, localizes likely code ownership, and keeps a rolling grouped summary until the user sends `OK GO`, `CANCEL`, or switches to another protocol.
- `OK GO` freezes intake and produces a fix and implementation plan in chat only. It does not write repo docs or code.

### Required reads

- `docs/CANONICAL.md`
- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `docs/SPRINT.md`
- `docs/WORKLOG.md` (last ~30 lines only)
- The smallest amount of code, config, and supporting docs needed to localize the reported issue

### Allowed writes

- None inside the repository

### Intake rules

- Keep one rolling in-memory audit summary across the session.
- Merge related evidence by likely root cause instead of creating a new issue for every fragment.
- Each active audit item should track observed behavior, expected behavior, repro context, likely frontend files, likely backend files, confidence, open unknowns, and a likely acceptance check.
- Use read-only helper agents only when they materially improve localization.
- If evidence is insufficient, ask for the next most useful screenshot, console error, network trace, or repro detail instead of guessing.

### Completion and stop conditions

- `HUMANAUDIT` stays active across user messages until `OK GO`, `CANCEL`, or an explicit switch to another protocol.
- If safe code localization is not yet possible, stop at an evidence request.
- If the user asks for implementation before `PLAN`, stop and redirect to `PLAN` or `RUNSPRINT`.

## PLAN

### Required reads

1. `docs/CANONICAL.md`
2. `AGENTS.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/ROADMAP.md`
5. `docs/SPRINT.md`
6. `docs/DECISIONS.md` (if present)
7. `docs/CANONICAL_REPORT.md` (recent relevant planning and conflict entries)
8. `docs/WORKLOG.md` (last ~30 lines only)
9. Only the specific `docs/client/**` documents the user explicitly names for this PLAN pass, or the specific customer documents needed to answer a customer-doc research question the user explicitly asked
10. Code, tests, config, schema, and supporting docs needed to localize the likely blast radius of each planned row

Customer-source documents under `docs/client/**` are skipped by default during PLAN.
PLAN may read customer docs only when the user explicitly:
- names the document or documents to use for that pass, or
- asks PLAN to search customer docs for specific information
Do not browse customer Word, Excel, PDF, or similar files opportunistically just because they exist or because the row touches workflow semantics.
If customer truth is needed but the user did not direct a customer-doc read, plan from canonical docs plus code reality and record `TBD` or a blocker instead of opening extra customer materials.

### Research subagent policy

- The parent agent must personally complete the required PLAN reads.
- Research helpers may assist only with follow-up context gathering after the parent completes the required reads.
- Research helpers are read-only and must not create alternative planning artifacts.
- The parent agent remains solely responsible for the final plan synthesis and all PLAN commits.

### Scope-proof planning rules

- PLAN must not emit or rewrite a sprint row until it has performed a code-localization pass for that row.
- For each planned row, localize the smallest truthful blast radius across user-visible surfaces, state and orchestration layers, API client and DTO files, backend, compute, persistence files, and directly coupled tests or config.
- If Acceptance implies a persisted field, workflow transition, import path, compute path, readiness state, or report outcome, the row `Files` scope must include the directly coupled end-to-end contract surfaces, not only the first touched component.
- When uncertain, overscope to the smallest truthful area rather than underscope to a speculative exact list.
- If the planner cannot localize the slice confidently, stop and record a blocker in `docs/PROJECT_STATUS.md` and `docs/CANONICAL_REPORT.md` instead of emitting an executable-looking row.

### Allowed writes

- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/SPRINT_ARCHIVE.md`
- `docs/PROJECT_STATUS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/DECISIONS.md` (append-only)
- `docs/WORKLOG.md`
- `docs/BACKLOG.md` and `docs/BACKLOG_ARCHIVE.md` only when the user explicitly asks for backlog maintenance
- `AGENTS.md` when the user explicitly asks for OS-contract changes

### Forbidden touch

- `apps/**`
- `packages/**`
- `prisma/**`
- `**/migrations/**`
- Any file not listed in allowed writes

### Required outputs

PLAN must produce the smallest truthful set of canonical updates needed for the change.
When the active sprint queue changes, update at least:

1. `docs/ROADMAP.md`
2. `docs/SPRINT.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/CANONICAL_REPORT.md`
5. `docs/WORKLOG.md`

Also update `docs/DECISIONS.md` when the change is a real durable decision, and `AGENTS.md` when the user asked for OS hardening.

When PLAN writes `docs/SPRINT.md`:

- `Files` must reflect the smallest truthful blast radius proven by the scope-proof pass.
- `run:` commands must be the narrowest truthful commands for the row.
- Use `covered by row-end bundle -> <command-set>` when multiple substeps share the same verification boundary.

### Worklog format

`- [HH:MM] PLAN: <one-line summary> (scope: <brief>)`

### Completion and stop conditions

- PLAN must end with one docs-only commit containing only allowed PLAN write files.
- If PLAN started with a clean tree, it must end clean after the PLAN commit.
- If PLAN started dirty, the PLAN commit must contain only allowed PLAN write files, and any remaining dirt must predate the PLAN run unless the user explicitly asked to include it.
- If requirement meaning is unknown, write a blocker in `docs/PROJECT_STATUS.md` and stop.
- If the missing requirement meaning would require browsing customer docs the user did not explicitly authorize for this pass, write a blocker and stop instead of opening those docs.
- If sources conflict and cannot be resolved by canonical order plus code reality, record the conflict in `docs/CANONICAL_REPORT.md` and stop.
- If PLAN cannot isolate its allowed doc changes from overlapping dirt in the same file, stop and report.

## RUNSPRINT

### Purpose

- `RUNSPRINT` is the only execution protocol.
- It executes sprint rows end to end, including implementation, verification, evidence capture, and row acceptance.
- The parent agent is always the orchestrator.

### Required reads

- `docs/CANONICAL.md`
- `AGENTS.md`
- `docs/SPRINT.md`
- `docs/WORKLOG.md` (last ~30 lines only)
- `docs/PROJECT_STATUS.md` only when the selected row depends on blocker state or runtime risk
- Code, tests, config, and runtime artifacts needed for the selected row

### Allowed writes

- Product-scope files explicitly listed in the selected active sprint row `Files` scope
- Minimal same-package gate-fix files allowed after a required verification command fails
- `docs/SPRINT.md`
- `docs/WORKLOG.md`
- During bounded same-slice scope repair only: `docs/PROJECT_STATUS.md` and `docs/CANONICAL_REPORT.md`

### Forbidden touch

- `docs/ROADMAP.md`
- `docs/CANONICAL.md`
- `docs/DECISIONS.md`
- `AGENTS.md`
- `docs/BACKLOG.md` and `docs/BACKLOG_ARCHIVE.md` unless the user explicitly asked for backlog maintenance in the same run

### Helper policy

- After selecting the current row, the parent may launch read-only `explorer` helpers or bounded `worker` helpers.
- Helper writes are limited to the active row `Files` scope plus any same-package gate-fix files the parent explicitly authorizes.
- Helpers must not update sprint or worklog docs, stage changes, or create commits.
- The parent must wait for all row-scoped helpers to finish before any commit, scope repair, or next-row selection.

### Selection and row engine

- Pick the first sprint row with `Status` in `TODO` or `IN_PROGRESS`.
- Execute that row until it reaches `DONE` or `BLOCKED`.
- Do not switch rows while the current row still has executable unchecked substeps.
- If all remaining rows are `DONE` or `BLOCKED`, stop.
- Under `RUNSPRINT`, a blocked row does not stop the whole sprint by itself. Record it cleanly and continue to the next executable row unless a global impossibility exists.

### Execution rules

- Before editing, record the baseline with `git status --porcelain`.
- `RUNSPRINT` may start from a dirty baseline only when every dirty path already fits the active row scope and can be safely absorbed into that row.
- If dirty paths fall outside scope, stop the row with `HARD BLOCKED: dirty baseline outside files-scope`.
- Certain same-area collateral files are implicitly in scope when their trigger area is in scope:
  - `pnpm-lock.yaml` with root or workspace `package.json`
  - same-workspace test, lint, typecheck, vitest, playwright, or harness config
  - same-workspace `test/**`
  - directly coupled auth or session client, server, route, context, and test files
  - required non-canonical operational or security notes for workflow or sensitive-config changes
- If a required `run:` command fails, `RUNSPRINT` may use a bounded same-package gate-fix: edit the minimal additional files in the same workspace package needed to make the required command pass.
- If a row cannot truthfully implement its explicitly stated behavior only because the sprint scope omitted minimal same-area collateral or directly coupled contract files, `RUNSPRINT` may widen the active row scope once inside `docs/SPRINT.md` before continuing.
- Broad cross-feature expansion remains blocked.

### Bounded scope repair

- If execution exposes a planning-scope gap beyond same-row scope widen or same-package gate-fix, do not silently hack around it.
- If the missing work stays inside the same feature slice and does not change milestone intent, customer scope, or requirement meaning, `RUNSPRINT` may perform one bounded scope-repair pass for the active row:
  - update `docs/SPRINT.md` to widen `Files`, add missing substeps, or sharpen `Acceptance` or `Stop`
  - update `docs/PROJECT_STATUS.md` with the blocker and remediation summary
  - append a conflict or resolution note to `docs/CANONICAL_REPORT.md`
  - append one `docs/WORKLOG.md` line
  - create one docs-only commit: `plan(S-XX): scope repair`
  - resume the same row after the tree is clean
- If the discovered gap changes requirement meaning, customer scope, milestone intent, or broadens beyond the same feature slice, stop with `HARD BLOCKED: planning scope gap requires PLAN`.

### Internal row acceptance

- Row acceptance is part of `RUNSPRINT`, not a separate protocol.
- After implementation and required verification, the parent must compare row Evidence against row Acceptance before marking the row `DONE`.
- Consume existing evidence first. Do not reflexively rerun the same broad verification command when the row evidence already proves acceptance.
- Rerun verification only when evidence is missing, acceptance is ambiguous, later edits invalidated the earlier proof, or scope drift is suspected.
- If acceptance is satisfied, set the row `Status=DONE`.
- If more work is required, keep the row `Status=IN_PROGRESS`.
- If the row cannot proceed within protocol bounds, set the row `Status=BLOCKED` and record the blocker in `Evidence`.

### Commit and evidence rules

- Successful rows require one product commit and one docs commit.
- Product commit message: `run(S-XX): <row summary>`.
- Docs commit message: `docs(S-XX): evidence update`.
- A blocked row requires one docs commit that records the blocker and worklog line.
- `docs/SPRINT.md` row evidence is authoritative. Use:
  `row:<product_hash> | run:<cmd or command-set> -> <result> | files:<paths from git show --name-only <product_hash>> | docs:<docs_hash> | status: clean`
- When baseline absorption or gate-fix was used, append `| baseline:absorbed` and/or `| gate-fix:<paths>` before `| status: clean`.
- After the row docs commit, `git status --porcelain` must be empty.

### Worklog format

`- [HH:MM] RUNSPRINT: <one-line row outcome> (row: S-XX, status: DONE|BLOCKED)`

### Stop conditions

- If a required run fails and cannot be fixed within the bounded same-package gate-fix rule, mark the row `BLOCKED` with `GATE BLOCKED: <reason>`.
- If a scope problem exceeds bounded scope-repair rules, mark the row `BLOCKED` with `HARD BLOCKED: planning scope gap requires PLAN`.
- If completing the row would require forbidden writes, mark the row `BLOCKED` and stop that row.
- If the tree cannot be made clean after the docs commit, mark the row `BLOCKED` with `HARD BLOCKED: dirty working tree`.
