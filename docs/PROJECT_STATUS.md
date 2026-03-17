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
- `S-95` is accepted: step-2 cards and step-3 review rows now expose focused repair actions for missing prices and volumes, and repair opens on the missing field instead of hiding behind generic manual mode.
- `S-96` is accepted: a year card can now open a QDIS PDF workflow, direct text is tried before OCR fallback, and confirmed QDIS prices/volumes can flow through the existing year patch path with dedicated import provenance.
- The active queue is now `S-97..S-98`, focused on explicit wizard-year provenance and the final wiped-workspace audit using the customer's 2022 export as the acceptance sample.

## Top blockers

1. Wizard-year provenance still does not present QDIS PDF distinctly on the step-2 and step-3 cards, even though the import flow now exists.
2. Imported QDIS values still need explicit source-layering above VEETI on the wizard-year cards after reload.
3. The sprint still lacks the final wiped-workspace live audit with the customer's 2022 QDIS export PDF.

## Next actions

1. Execute `S-97` to expose truthful VEETI/manual/bokslut/QDIS provenance and keep imported QDIS values current above VEETI.
2. Execute `S-98` to close with focused regressions and a wiped-workspace live audit using the 2022 QDIS PDF.
3. Use the real 2022 customer QDIS export as the final acceptance sample once the provenance row is complete.

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
