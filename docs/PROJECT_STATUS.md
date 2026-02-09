# Project status

## Goal

Plan20: Finnish water-utility financial planning. Budgets from KVA Excel, revenue drivers (vesi/jatevesi), multi-year projections, tariff justification. Working VA budget flow with demo mode.

## Active milestone

**M0: Define milestones with customer** — waiting for customer meeting. See [ROADMAP.md](ROADMAP.md).

## Current state

- KVA import live: preview-kva + confirm-kva create budget in one transaction (Talousarvio + valisummat + tuloajurit).
- Revenue drivers extracted from Vatten KVA / Avlopp KVA / Anslutningar; persisted when meaningful; returned by GET `/budgets/:id`.
- Budget page uses valisummat (when rivit empty) with double-count filter. Duplicate name+year → 409.
- Demo mode on in dev. Legacy modules still compiled; UI targets VA budget.
- Canonical docs in place: [CANONICAL.md](CANONICAL.md). 10 deprecated docs marked.

## Sprint focus

See [SPRINT.md](SPRINT.md) — up to 5 items (verify tests, lint, update TESTING/DEPLOYMENT docs).

## Blockers / decisions needed

- Awaiting customer input to define M1 scope. Questions listed in [ROADMAP.md](ROADMAP.md) under M0.
- **Questions for Dad:** (1) Priority: KVA robustness, reporting/PDF, or multi-budget? (2) One budget per org or budget selector on Revenue/Projection? (3) Regulatory export format (FACIT)?
- **Workflow:** Each plan / do / review run appends exactly one line to [WORKLOG.md](WORKLOG.md) (self-documenting).

## Key links

| Doc | Purpose |
|-----|---------|
| [ROADMAP.md](ROADMAP.md) | Milestones and epics |
| [SPRINT.md](SPRINT.md) | Active work (max 5 items) |
| [BACKLOG.md](BACKLOG.md) | Unordered task pool |
| [WORKLOG.md](WORKLOG.md) | Append-only session history |
| [DECISIONS.md](DECISIONS.md) | ADRs (001–009 so far) |
| [CANONICAL.md](CANONICAL.md) | Doc entry point and system truth |
