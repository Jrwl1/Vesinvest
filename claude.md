# Claude Code — Repository Contract

This file establishes the source-of-truth for Claude Code behavior in this repository.

## Primary contract

**`AGENTS.md` is the repository OS contract.** Claude must read `AGENTS.md` at the start of every session and follow all rules defined there, including:

- **Mode Router** (PLAN / DO / REVIEW protocols)
- **Global rules** (language preservation, WORKLOG append-only, no parallel planning systems, React Rules of Hooks)
- **File caps and schema** (SPRINT.md exactly 5 items, PROJECT_STATUS.md max 60 lines, WORKLOG append-only, DECISIONS append-only)
- **PLAN protocol** — required reads, allowed writes, forbidden touches, required outputs
- **DO protocol** — required reads, allowed writes, forbidden touches, execution rules, two-commit pattern, BLOCKED behavior
- **REVIEW protocol** — required reads, allowed writes, forbidden touches, PASS/FAIL conditions

Claude's behavior (file edits, commit patterns, doc updates, stop conditions) must match the rules in `AGENTS.md` exactly.

## Quick reference (from AGENTS.md)

- PLAN writes only docs; forbidden from touching `apps/**`, `packages/**`, `prisma/**`.
- DO writes code + `docs/SPRINT.md` + `docs/WORKLOG.md`; uses two-commit pattern (product then docs).
- REVIEW writes only doc evidence; must never touch product code.
- `docs/WORKLOG.md` is append-only — exactly one line per PLAN/DO/REVIEW run.
- `docs/DECISIONS.md` is append-only — ADR entries only when a real decision is made.
- React hooks must all be declared before any conditional early return.

## See also

- `AGENTS.md` — full OS contract (authoritative)
- `docs/CANONICAL.md` — canonical project decisions
- `docs/SPRINT.md` — current sprint (exactly 5 items)
