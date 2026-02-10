# Agent contract

How AI agents operate in this repo. Three protocols: **plan**, **do**, **review**.

---

## PLAN protocol

**Trigger:** User says "plan" (in Codex chat or similar).

**Purpose:** Update roadmap, sprint, and status based on new information (customer input, completed work, discovered issues).

**Reads:** `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/SPRINT.md`, `docs/BACKLOG.md`, `docs/CANONICAL.md`, `docs/DECISIONS.md`, `docs/WORKLOG.md` (last ~30 lines only).

**Writes (allowed):**
- `docs/ROADMAP.md` — add/update milestones
- `docs/SPRINT.md` — promote items from backlog (max 5 items)
- `docs/BACKLOG.md` — add discovered tasks
- `docs/PROJECT_STATUS.md` — update state, milestone, blockers (max ~60 lines)
- `docs/DECISIONS.md` — append new ADR if a real design decision is made (append-only)
- `docs/WORKLOG.md` — append **exactly one** entry per PLAN run (append-only; see format below)

**Must not write:** Code files, `docs/CANONICAL.md`, `AGENTS.md`. PLAN must not rewrite or reread the full WORKLOG; it may read only the last ~30 lines.

**WORKLOG entry format (PLAN only):**  
`- [HH:MM] PLAN: <one-line summary> (sprint: S-xx..S-yy, milestone: Mx)`

**Rules:**
- SPRINT.md must never exceed 5 items.
- PROJECT_STATUS.md must never exceed ~60 lines.
- If uncertain about scope or priority, write a question under "Blockers / decisions needed" in PROJECT_STATUS.md and stop.
- Do not invent product scope. Only reflect what the user or customer has said.

---

## DO protocol

**Trigger:** User says "do" (in Cursor).

**Purpose:** Execute the current sprint. Pick the top incomplete item from `docs/SPRINT.md` and implement it.

**Reads:** `docs/SPRINT.md`, `docs/PROJECT_STATUS.md`, `docs/CANONICAL.md` (for system truth), any code files needed for the task.

**Writes (allowed):**
- Code files (as needed by the sprint item)
- `docs/WORKLOG.md` — append **exactly one** entry per DO run (append-only; format below)
- `docs/SPRINT.md` — mark item as done or update "Done when" evidence
- `docs/BACKLOG.md` — add newly discovered tasks

**Must not write:** `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md`, `docs/CANONICAL.md`, `AGENTS.md`. DO must not rewrite or reread the full WORKLOG; it may read only the last ~30 lines.

**Always-follow rules (repo invariants):**
- Frontend: any new UI string must be added to fi.json, sv.json, en.json.
- React: hooks must be declared before any conditional return.
- Backend: all DB queries must remain org-scoped (TenantGuard + orgId as first param convention).
- Never add auto-login or bypass the login page.
- Money display must use formatCurrency() from the existing utils (if present in repo).

*[docs/playbooks/PROMPTS.md](docs/playbooks/PROMPTS.md) contains templates; read it only when you need a template.*

**WORKLOG entry format (DO only):**  
`- [HH:MM] DO: <one-line summary> (sprint: S-xx, links: <commit or file paths>)`

**Rules:**
- Work on one sprint item at a time, top to bottom.
- Each DO run appends exactly one line to WORKLOG (append-only). After completing an item, append that entry and move to the next.
- If blocked, write the blocker in the sprint item row and stop. Do not skip ahead.
- If the task reveals a design decision, note it in WORKLOG and flag for the next "plan" session.
- Do not modify docs outside the allowed set.

---

## REVIEW protocol

**Trigger:** User says "review" (in Codex chat or similar).

**Purpose:** Audit the current state: are docs consistent with code? Is the sprint progressing? Any drift?

**Reads:** `docs/PROJECT_STATUS.md`, `docs/SPRINT.md`, `docs/ROADMAP.md`, `docs/BACKLOG.md`, `docs/WORKLOG.md` (last ~30 lines), `docs/CANONICAL.md`, `docs/DECISIONS.md`, code files as needed.

**Writes (allowed):**
- `docs/PROJECT_STATUS.md` — update current state if drift found (max ~60 lines)
- `docs/BACKLOG.md` — add discovered issues or tasks
- `docs/WORKLOG.md` — append **exactly one** entry per REVIEW run (append-only; format below)

**Must not write:** `docs/ROADMAP.md`, `docs/SPRINT.md`, `docs/DECISIONS.md`, `docs/CANONICAL.md`, `AGENTS.md`, code files. REVIEW must not rewrite or reread the full WORKLOG; it may read only the last ~30 lines.

**WORKLOG entry format (REVIEW only):**  
`- [HH:MM] REVIEW: <one-line summary> (findings: <brief>)`

**Rules:**
- Each REVIEW run appends exactly one line to WORKLOG (append-only).
- Compare SPRINT items against code reality. Flag items that are already done or blocked.
- Check PROJECT_STATUS "Current state" against actual code (endpoints, tests, schema). Flag drift.
- If a decision has been made implicitly (code changed without ADR), flag it for the next "plan" session.
- Output a short review summary to the user.

---

## Caps and invariants

| File | Cap | Rule |
|------|-----|------|
| `docs/SPRINT.md` | 5 items | Never exceed. Finish or drop before adding. |
| `docs/PROJECT_STATUS.md` | ~60 lines | Keep it a snapshot, not a narrative. |
| `docs/WORKLOG.md` | Append-only | Never rewrite, delete, or refactor. Only read last ~30 lines. PLAN / DO / REVIEW each may append exactly one entry per run (formats in respective sections). |
| `docs/DECISIONS.md` | Append-only | Only add entries; never edit or remove existing ADRs. |
| `docs/CANONICAL.md` | Protected | Agents must not modify. Link to it, don't rewrite it. |

## Verified repo commands

From `package.json` scripts:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run API + web in parallel |
| `pnpm build` | Build packages then apps |
| `pnpm build:api` | Build API only |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | TypeScript check all workspaces |
| `pnpm test` | Run tests across workspaces |
| `pnpm next:steps` | Update repo.md next-steps from notes/chat-latest.md |
