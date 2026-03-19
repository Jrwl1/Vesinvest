# Project status

Last updated: 2026-03-19

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The selective repair and Forecast hardening queue through `S-112` is accepted and closed: reset cleanliness, sync-save card truth, mapped depreciation compute, capex-aware funding hierarchy, and report creation/export all passed in the remediated flow.
- A fresh full dev-site audit still found CFO-facing trust gaps across the live `Overview -> Forecast -> Reports` path.
- Ennuste now has real capex/depreciation power, but the default mapping and `Poistosaannot` flow remain too technical, too jargon-heavy, and too manual for confident CFO self-service.
- `S-113` is now accepted and closed: Step 3 no longer changes review state through `Continue`; explicit approval or save is required before a technically ready year counts as reviewed.
- `S-114` is now accepted and closed: missing canon finance rows such as `Material och tjanster` now force `needs attention` and stay out of the planning-baseline path until corrected or excluded.
- `S-115` is now accepted and closed: the wizard summary label no longer leaks Finnish fallback text, the depreciation-mapping report gate is localized, and Reports no longer shows first-report copy when reports already exist.
- `S-116` is now accepted and closed: the baseline-ready handoff into Ennuste now surfaces a dedicated first-scenario starting point instead of a generic empty scenario shelf.
- `S-117` is now accepted and closed: future investment years now show explicit default suggestions, optional carry-forward from the previous saved year, and a clear save-required report block until the mapping is persisted.

## Top blockers

1. The Forecast depreciation/report path is still too technical for a low-friction CFO workflow beyond the new default/carry-forward shortcuts.
2. Forecast/Reports still carry accessibility and hierarchy cleanup debt from the live audit.
3. The full reset-to-PDF CFO audit still needs to be rerun after the remaining Forecast/Reports fixes.

## Next actions

1. Continue the active queue from `S-118` to simplify the Poistosaannot workbench and make rule impact visibly defensible.
2. Re-run a full reset -> connect -> import -> review -> baseline -> forecast -> report audit after the remaining Forecast/Reports fixes.
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
