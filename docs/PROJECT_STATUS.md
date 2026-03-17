# Project status

Last updated: 2026-03-17

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The `Yhteenveto` perfection queue through `S-92` is accepted and closed.
- `S-93` is accepted: step 2 now leads with year selection, uses short literal copy, and keeps only compact supporting summary chrome after the action surface.
- Code reality confirms that manual year prices/volumes already exist in the patch flow and that `bokslut PDF` OCR already exists, but there is no per-year QDIS PDF import for prices/volumes.
- The active queue is now `S-94..S-98`, focused on board-density/trust cleanup, direct repair affordances, and per-year QDIS PDF import using the customer's 2022 export as the acceptance sample.

## Top blockers

1. Suspicious/blocked year cards still use the older noisier board treatment instead of the denser calmer hierarchy targeted by `S-94`.
2. Missing prices and volumes still lack direct repair affordances from the year cards, so blocked/suspicious fixes remain slower than they should be.
3. QDIS PDF import does not exist; current PDF import is `bokslut`-only and financial-fields-only.

## Next actions

1. Execute `S-94` to rebuild the ready/suspicious/blocked board into a denser high-trust layout with calmer warning treatment.
2. Execute `S-95` to expose direct repair actions for missing prices and volumes from the year cards and review flow.
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
