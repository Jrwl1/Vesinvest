# Project status

Last updated: 2026-03-19

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The selective repair and Forecast hardening queue through `S-112` is accepted and closed: reset cleanliness, sync-save card truth, mapped depreciation compute, capex-aware funding hierarchy, and report creation/export all passed in the remediated flow.
- A fresh full dev-site audit still found CFO-facing trust gaps across the live `Overview -> Forecast -> Reports` path.
- Current year-readiness semantics remain too loose for finance trust: a year missing a canon finance row such as `Material och tjanster` can still look baseline-eligible if the higher-level VEETI datasets exist.
- Ennuste now has real capex/depreciation power, but the default mapping and `Poistosaannot` flow remain too technical, too jargon-heavy, and too manual for confident CFO self-service.
- Mixed-language fallback and stale empty-state/help copy are still visible on wizard, Forecast, and Reports primary surfaces.
- `S-113` is now accepted and closed: Step 3 no longer changes review state through `Continue`; explicit approval or save is required before a technically ready year counts as reviewed.

## Top blockers

1. Missing canon finance rows are not yet first-class blockers in wizard readiness and planning-baseline truth.
2. The Forecast depreciation/report path is powerful but still too technical and language-mixed for a low-friction CFO workflow.
3. Mixed-language fallback and stale helper copy still weaken trust on wizard, Forecast, and Reports primary surfaces.

## Next actions

1. Continue the active queue from `S-114` to tighten baseline truth, CFO-safe depreciation defaults, mixed-language/stale copy, and Reports/Forecast polish.
2. Re-run a full reset -> connect -> import -> review -> baseline -> forecast -> report audit after those fixes.
3. Keep the cross-year sold-volume source question explicit if workbook-driven volume override returns to scope.

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
