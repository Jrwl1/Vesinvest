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
- `S-22` is `DONE`: Overview now acts as the trusted-year review workspace with explicit VEETI-vs-effective comparison, year-review actions, and regression proof.
- `S-23` is `DONE`: Forecast now uses effective-baseline provenance and supports a structured 20-year investment program with compatibility coverage.
- `S-24` is `DONE`: fee sufficiency outputs, stress presets, side-by-side risk comparison, and regression proof are accepted in review.
- `S-25` is partially implemented: report variant contract, Reports preview controls, provenance-aware summaries, PDF section composition, and report-flow regression proof are shipped; only the final quality gates remain open.

## Top blockers

1. Final root quality gates for the planning cycle are still open.
2. Customer-owned `B-TBD-01..B-TBD-05` remain unresolved but non-blocking.
3. No new product blocker is verified inside the current sprint rows.

## Next 5 actions

1. Finish `S-25` by running final root quality gates and collecting PASS evidence.
2. REVIEW `S-25` for `DONE` once the quality-gate evidence is in place.
3. Keep customer TBDs `B-TBD-01..B-TBD-05` tracked as non-blocking.
4. Preserve the new statement-import, year-review, and structured investment flow while Forecast and Reports continue to evolve.
5. Keep root quality gates green as the fee/risk and report-variant rows advance.

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
