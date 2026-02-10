# Agent contract

This file is the repository OS contract.

## Mode Router (strict)

1. Read the user's first non-empty line.
2. If that line starts with exactly `PLAN`, run the PLAN protocol.
3. If that line starts with exactly `DO`, run the DO protocol.
4. If that line starts with exactly `REVIEW`, run the REVIEW protocol.
5. Otherwise, reply with exactly: `Use PLAN, DO, or REVIEW.` and stop.

## Global rules

- Preserve each file's current language. Do not translate entire files.
- Tool/agent instructions must be written in ENGLISH.
- WORKLOG read limit: only the last ~30 lines.
- Never create parallel planning systems.
- `docs/WORKLOG.md` is append-only.
- `docs/DECISIONS.md` is append-only.

## File caps and schema

| File | Hard rule |
|---|---|
| `docs/SPRINT.md` | Exactly 5 active items. No questions. Each row must include: `ID`, `Do`, `Files`, `Acceptance`, `Evidence`, `Stop`, `Status`. |
| `docs/PROJECT_STATUS.md` | Max 60 lines. Must remain a short snapshot. |
| `docs/WORKLOG.md` | Append exactly one line per run (PLAN/DO/REVIEW). |
| `docs/DECISIONS.md` | Append ADR entries only when a real decision is made. |

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
3. Updated `docs/SPRINT.md` (exactly 5 executable DO items)
4. Updated `docs/PROJECT_STATUS.md` (short snapshot)
5. Updated `docs/CANONICAL_REPORT.md` (changes + conflict resolution)
6. Optional `docs/DECISIONS.md` ADR append(s) when needed
7. Exactly one PLAN line in `docs/WORKLOG.md`

### WORKLOG format
`- [HH:MM] PLAN: <one-line summary> (sprint: S-xx..S-yy, milestone: Mx)`

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
- Code files needed for the top incomplete sprint item.

### ALLOWED WRITES
- Code files required by the selected sprint item
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
- Always execute the top incomplete sprint item only.
- Do not pull new scope from outside `docs/SPRINT.md`.
- Update sprint Evidence with concrete artifacts (file paths, test commands, commit hash).

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

### ALLOWED WRITES
- `docs/PROJECT_STATUS.md`
- `docs/BACKLOG.md`
- `docs/CANONICAL_REPORT.md`
- `docs/WORKLOG.md` (append exactly one REVIEW line)

### FORBIDDEN TOUCH
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/DECISIONS.md`
- `docs/CANONICAL.md`
- `AGENTS.md`
- Product code files

### REVIEW OUTPUT RULES
- Verify sprint Evidence against Acceptance criteria.
- If Evidence is missing for a `TODO` sprint item, output `Evidence needed` for that item and continue review.
- Continue with structural checks even when Evidence is missing: sprint format, scope boundaries, forbidden-touch compliance, and planning drift.
- Report findings first, ordered by severity.
- Update status/backlog only when drift is verified.

### WORKLOG format
`- [HH:MM] REVIEW: <one-line summary> (findings: <brief>)`

### STOP CONDITIONS
- If forbidden file changes are detected, stop.
- If scope violations are detected, stop.
- If contradictions in canonical hierarchy are detected, stop.
