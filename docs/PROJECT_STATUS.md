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
- `S-97` is accepted: step-2 and step-3 cards now show explicit VEETI/manual/bokslut/QDIS source layering, and QDIS-backed values stay marked as the current effective source after reload.
- The active queue is now `S-98`, focused on the final regression closeout and the wiped-workspace audit using the customer's 2022 export as the acceptance sample.

## Top blockers

1. The sprint still lacks the final wiped-workspace live audit with the customer's 2022 QDIS export PDF.
2. Final focused regressions still need to be recorded against the now-shipped QDIS surfaces before the sprint can close.
3. If the real 2022 QDIS PDF reveals an unmapped structure or workflow gap, that blocker still needs to be captured in the audit artifact.

## Next actions

1. Execute `S-98` to record the final focused regressions for the year board, direct repair CTAs, and QDIS import flow.
2. Run the wiped-workspace live audit with the real 2022 customer QDIS export PDF and capture the explicit sprint outcome.
3. If the PDF is unavailable or the live flow still breaks, record the concrete blocker in the audit artifact instead of guessing.

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
