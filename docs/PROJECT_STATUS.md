# Project status

Last updated: 2026-03-08

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Forecast/Reports trust hardening sprint `S-11..S-20` remains completed.
- Active sprint is `S-21..S-25` for statement import, trusted-year review, effective-baseline Forecast, fee/risk outputs, and report variants.
- `S-21` is `DONE`: browser OCR statement import, preview/confirm flow, local OCR assets, provenance persistence, and PDF export compatibility are accepted in review.
- `S-22` is materially implemented in Overview, but explicit VEETI-vs-effective review proof and re-apply regression evidence remain open.
- `S-23` is partially implemented: Forecast uses effective-baseline provenance, but the structured 20-year investment model is still open.
- `S-24` is still ahead; dedicated fee sufficiency and financial-risk outputs remain the main open product work.
- `S-25` is partially implemented: provenance-aware Reports shipped, but public/confidential variants and end-to-end regression proof remain open.

## Top blockers

1. Public/confidential report variants are not implemented yet.
2. Structured 20-year investment persistence plus explicit fee/risk outputs remain open.
3. `S-22` still needs explicit VEETI-vs-effective comparison proof and re-apply regression coverage.

## Next 5 actions

1. Finish remaining `S-22` items: explicit VEETI-vs-effective comparison and clean re-apply proof.
2. Continue `S-23` structured 20-year investment model work in Forecast.
3. Continue `S-24` fee sufficiency and stress-risk outputs on top of effective baseline data.
4. Finish `S-25` public/confidential variants and end-to-end regression proof.
5. Keep customer TBDs `B-TBD-01..B-TBD-05` tracked as non-blocking.

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
