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
- `S-24` is still ahead; dedicated fee sufficiency and financial-risk outputs remain the main open product work.
- `S-25` is partially implemented: provenance-aware Reports shipped, but public/confidential variants and end-to-end regression proof remain open.

## Top blockers

1. Public/confidential report variants are not implemented yet.
2. Explicit fee sufficiency and financial-risk outputs remain open.
3. Public/confidential report variants are still not implemented.

## Next 5 actions

1. Continue `S-24` fee sufficiency and stress-risk outputs on top of effective baseline data.
2. Finish `S-25` public/confidential variants and end-to-end regression proof.
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
