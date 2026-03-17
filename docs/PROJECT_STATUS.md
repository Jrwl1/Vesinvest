# Project status

Last updated: 2026-03-17

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The `Yhteenveto` perfection queue through `S-92` is accepted and closed.
- `S-93` is accepted: step 2 now leads with year selection, uses short literal copy, and keeps only compact supporting summary chrome after the action surface.
- `S-94` is accepted: the year board is denser, blocked years collapse by default, and missing data is summarized once per card instead of repeating orange missing-state boxes.
- Code reality confirms that manual year prices/volumes already exist in the patch flow and that `bokslut PDF` OCR already exists, but there is no per-year QDIS PDF import for prices/volumes.
- The active queue is now `S-95..S-98`, focused on direct repair affordances and per-year QDIS PDF import using the customer's 2022 export as the acceptance sample.

## Top blockers

1. Missing prices and volumes still lack direct repair affordances from the year cards, so blocked/suspicious fixes remain slower than they should be.
2. QDIS PDF import does not exist; current PDF import is `bokslut`-only and financial-fields-only.
3. Wizard-year provenance still cannot distinguish QDIS PDF from other manual/imported sources because that flow does not exist yet.

## Next actions

1. Execute `S-95` to expose direct repair actions for missing prices and volumes from the year cards and review flow.
2. Execute `S-96..S-97` to add QDIS PDF import and truthful VEETI/manual/bokslut/QDIS provenance in the wizard-year surfaces.
3. Execute `S-98` to close with focused regressions and a wiped-workspace live audit using the 2022 QDIS PDF.

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
