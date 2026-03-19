# Project status

Last updated: 2026-03-19

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The selective repair and Forecast hardening queue through `S-112` is accepted and closed: reset cleanliness, sync-save card truth, mapped depreciation compute, capex-aware funding hierarchy, and report creation/export all passed in the remediated flow.
- A fresh full dev-site audit still found CFO-facing trust gaps across the live `Overview -> Forecast -> Reports` path.
- Ennuste now has real capex/depreciation power, and `S-117..S-118` removed the biggest default/jargon traps; the remaining gaps are Forecast/Reports polish, accessibility cleanup, and the final CFO audit.
- `S-113` is now accepted and closed: Step 3 no longer changes review state through `Continue`; explicit approval or save is required before a technically ready year counts as reviewed.
- `S-114` is now accepted and closed: missing canon finance rows such as `Material och tjanster` now force `needs attention` and stay out of the planning-baseline path until corrected or excluded.
- `S-115` is now accepted and closed: the wizard summary label no longer leaks Finnish fallback text, the depreciation-mapping report gate is localized, and Reports no longer shows first-report copy when reports already exist.
- `S-116` is now accepted and closed: the baseline-ready handoff into Ennuste now surfaces a dedicated first-scenario starting point instead of a generic empty scenario shelf.
- `S-117` is now accepted and closed: future investment years now show explicit default suggestions, optional carry-forward from the previous saved year, and a clear save-required report block until the mapping is persisted.
- `S-118` is now accepted and closed: the Poistosaannot workbench now uses clearer plan/status language, and straight-line, residual, and custom schedule rule edits are proven through engine, API, and Forecast UI evidence.

## Top blockers

1. Forecast/Reports still carry hierarchy and accessibility cleanup debt from the live audit.
2. The remaining Reports/Forecast polish queue in `S-119` is still open.
3. The full reset-to-PDF CFO audit still needs to be rerun after `S-119`.

## Next actions

1. Continue the active queue from `S-119` to remove the remaining Forecast/Reports polish and accessibility gaps.
2. Re-run a full reset -> connect -> import -> review -> baseline -> forecast -> report audit after `S-119`.
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
