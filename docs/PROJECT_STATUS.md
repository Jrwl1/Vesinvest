# Project status

Last updated: 2026-03-19

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The selective repair and Forecast hardening queue through `S-112` is accepted and closed: reset cleanliness, sync-save card truth, mapped depreciation compute, capex-aware funding hierarchy, and report creation/export all passed in the remediated flow.
- A fresh full dev-site audit still found CFO-facing trust gaps across the live `Overview -> Forecast -> Reports` path.
- Ennuste and Reports now have the audited Forecast/Reports polish fixes through `S-119`; the remaining known gate is the final CFO reset-to-PDF audit.
- `S-113` is now accepted and closed: Step 3 no longer changes review state through `Continue`; explicit approval or save is required before a technically ready year counts as reviewed.
- `S-114` is now accepted and closed: missing canon finance rows such as `Material och tjanster` now force `needs attention` and stay out of the planning-baseline path until corrected or excluded.
- `S-115` is now accepted and closed: the wizard summary label no longer leaks Finnish fallback text, the depreciation-mapping report gate is localized, and Reports no longer shows first-report copy when reports already exist.
- `S-116` is now accepted and closed: the baseline-ready handoff into Ennuste now surfaces a dedicated first-scenario starting point instead of a generic empty scenario shelf.
- `S-117` is now accepted and closed: future investment years now show explicit default suggestions, optional carry-forward from the previous saved year, and a clear save-required report block until the mapping is persisted.
- `S-118` is now accepted and closed: the Poistosaannot workbench now uses clearer plan/status language, and straight-line, residual, and custom schedule rule edits are proven through engine, API, and Forecast UI evidence.
- `S-119` is now accepted and closed: Reports labels now track the selected saved report and current report status, the dead duplicate-id Forecast branch is removed, rendered Forecast/Reports DOMs are guarded for unique ids, and the current-page browser console is clean after auth reload.

## Top blockers

1. The final reset-to-PDF CFO audit in `S-120` is still pending.
2. The full reset -> connect -> import -> review -> baseline -> forecast -> report path still needs current live evidence after `S-113..S-119`.
3. Customer-owned TBDs remain open for the final acceptance lock, though they are not blocking the current sprint execution.

## Next actions

1. Continue the active queue from `S-120` to run the full reset -> connect -> import -> review -> baseline -> forecast -> report audit.
2. Record any remaining blocker from that live audit precisely or close the sprint if the path is clean.
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
