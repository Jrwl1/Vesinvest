# Project status

Last updated: 2026-03-19

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The selective repair and Forecast hardening queue through `S-112` is accepted and closed: reset cleanliness, sync-save card truth, mapped depreciation compute, capex-aware funding hierarchy, and report creation/export all passed in the remediated flow.
- The CFO-readiness queue `S-113..S-120` is now accepted and closed.
- A fresh reset -> connect -> import -> review -> baseline -> forecast -> report -> PDF audit succeeded on the remediated build, including live fixes for Forecast report-freshness truth and the first-scenario baseline-year handoff.
- `S-113` is now accepted and closed: Step 3 no longer changes review state through `Continue`; explicit approval or save is required before a technically ready year counts as reviewed.
- `S-114` is now accepted and closed: missing canon finance rows such as `Material och tjanster` now force `needs attention` and stay out of the planning-baseline path until corrected or excluded.
- `S-115` is now accepted and closed: the wizard summary label no longer leaks Finnish fallback text, the depreciation-mapping report gate is localized, and Reports no longer shows first-report copy when reports already exist.
- `S-116` is now accepted and closed: the baseline-ready handoff into Ennuste now surfaces a dedicated first-scenario starting point instead of a generic empty scenario shelf.
- `S-117` is now accepted and closed: future investment years now show explicit default suggestions, optional carry-forward from the previous saved year, and a clear save-required report block until the mapping is persisted.
- `S-118` is now accepted and closed: the Poistosaannot workbench now uses clearer plan/status language, and straight-line, residual, and custom schedule rule edits are proven through engine, API, and Forecast UI evidence.
- `S-119` is now accepted and closed: Reports labels now track the selected saved report and current report status, the dead duplicate-id Forecast branch is removed, rendered Forecast/Reports DOMs are guarded for unique ids, and the current-page browser console is clean after auth reload.
- `S-120` is now accepted and closed: the focused regression bundle passed, the live reset-to-PDF audit succeeded, and the final flow created a report plus a successful PDF response after the Forecast freshness fix.

## Top blockers

1. No active sprint blockers remain in the accepted CFO-readiness queue.
2. Customer-owned TBDs remain open for the final acceptance lock.
3. Further implementation work now requires a new PLAN pass or explicit user direction.

## Next actions

1. Preserve `docs/CFO_END_TO_END_AUDIT_2026-03-19.md` as the current reset-to-PDF acceptance record.
2. Start a new PLAN pass if you want to continue into the next milestone or a post-audit cleanup queue.
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
