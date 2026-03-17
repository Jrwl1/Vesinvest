# Project status

Last updated: 2026-03-17

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The `Yhteenveto` perfection queue through `S-92` is accepted and closed.
- A new human audit of the setup year-intake flow found four customer-visible gaps: verbose step-2 copy, dead summary/helper chrome, noisy orange/red trust cards, and missing direct repair affordances for prices and volumes.
- Code reality confirms that manual year prices/volumes already exist in the patch flow and that `bokslut PDF` OCR already exists, but there is no per-year QDIS PDF import for prices/volumes.
- The next active sprint is `S-93..S-98`, focused on step-2 modernization and per-year QDIS PDF import using the customer's 2022 export as the acceptance sample.

## Top blockers

1. Step 2 still over-explains and hides the actual year-selection task behind low-value helper chrome and dead space.
2. Suspicious/blocked year cards remain visually noisy and do not give a direct obvious path to fix missing prices/volumes.
3. QDIS PDF import does not exist; current PDF import is `bokslut`-only and financial-fields-only.

## Next actions

1. Execute `S-93` to simplify step-2 copy/layout and remove dead hero/helper space.
2. Execute `S-94..S-95` to compress the trust board and expose direct repair actions from the year cards.
3. Execute `S-96..S-98` to add QDIS PDF import, layer imported values truthfully above VEETI, and close with a wiped-workspace live audit using the 2022 QDIS PDF.

## Customer TBD tracking

Customer-owned unknowns remain tracked in `docs/BACKLOG.md` as `B-TBD-01..B-TBD-05`.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
