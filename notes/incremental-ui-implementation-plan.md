# Incremental UI Implementation Plan

Status: temporary working plan
Owner: Codex
Branch target: `main`
Visual reference: `apps/web/src/mockup/VesipolkuMockup.tsx` and `apps/web/src/mockup/VesipolkuMockup.css`

## Purpose

This file is a non-canonical working plan for implementing the refreshed V2 UI incrementally without losing context between screens.

The visual direction comes from Claude's mockup, but the implementation must preserve:

- live V2 workflow logic
- current API contracts
- existing route behavior
- existing `react-i18next` translation pattern
- current compute/report freshness rules
- current statement import, reconcile, and sync behavior

## Core implementation rules

1. Work on `main`.
2. Treat the mockup as a reference, not a literal drop-in.
3. Refresh one screen at a time.
4. Only make shared shell/style changes that are necessary for the active screen.
5. Preserve behavior first, improve layout second, polish third.
6. Do not let a visual refactor silently change product semantics.

## Shared visual goals

- calmer, more legible shell
- tighter hierarchy for KPIs and section headers
- stronger surface, badge, and table consistency
- explicit trust/provenance emphasis
- desktop-first but responsive
- less visual noise than the mockup where needed

## What to keep from the mockup

- restrained palette and spacing
- cleaner header and tab treatment
- stronger year-review cards
- clearer KPI strips
- report detail layout
- provenance/status badge language

## What to improve beyond the mockup

- make Forecast editor-first instead of presentation-first
- make Overview actions more obviously workflow-safe
- make Reports variant behavior more concrete
- reduce decorative blur/gradient use where it competes with data
- keep all real empty/loading/error states

## Sequence

1. Shared shell minimum
2. Overview refresh
3. Forecast refresh
4. Reports refresh
5. Shared cross-screen alignment
6. Hardening and cleanup

## Phase 0: Shared Shell Minimum

Goal:
Introduce only the shared visual primitives required to support the first screen.

Primary files:

- `apps/web/src/v2/AppShellV2.tsx`
- `apps/web/src/v2/v2.css`

Changes:

- tighten header spacing and navigation hierarchy
- normalize card, badge, button, table, and section header styles
- add reusable status badge variants for trust/provenance states
- improve content width and responsive spacing
- preserve current path syncing and tab behavior exactly

Do not do yet:

- full cross-screen shell rewrite
- major account drawer redesign
- unrelated login/auth styling work

Checkpoint:

- Overview can use the new shell primitives without visual hacks
- untouched screens still work with acceptable styling

## Phase 1: Overview Refresh

Goal:
Turn Overview into a clearer trust-review workspace using live data and existing actions.

Primary files:

- `apps/web/src/v2/OverviewPageV2.tsx`
- `apps/web/src/v2/v2.css`
- `apps/web/src/v2/yearReview.ts`
- `apps/web/src/v2/overviewWorkflow.ts`
- `apps/web/src/api.ts`
- `apps/web/src/i18n/locales/fi.json`
- `apps/web/src/i18n/locales/en.json`
- `apps/web/src/i18n/locales/sv.json`

Required UX structure:

- readiness summary first
- year review cards second
- VEETI vs effective comparison table third
- peer snapshot and secondary operational context last

Must preserve:

- VEETI connect/search/sync flow
- statement import flow
- manual edit flow
- reconcile/apply VEETI flow
- excluded/restore year behavior
- sync-year readiness logic

Key improvements beyond current UI:

- clearer trust-state hierarchy
- more obvious next actions per year
- dataset-level provenance visible without opening deep UI first
- comparison table easier to scan
- peer benchmark visually secondary

Potential pitfalls:

- hiding important actions behind compact menus
- making status badges look nice but less informative
- over-compressing year data so users miss blockers

Definition of done for this phase:

- user can immediately tell which years are trusted
- user can see what blocks planning
- user can act on a year without hunting for controls
- no regression in statement/manual/reconcile/sync flows

## Phase 2: Forecast Refresh

Goal:
Refresh Forecast using the same visual system while keeping it an editing workspace, not just a summary dashboard.

Primary files:

- `apps/web/src/v2/EnnustePageV2.tsx`
- `apps/web/src/v2/v2.css`
- `apps/web/src/api.ts`
- `apps/web/src/i18n/locales/fi.json`
- `apps/web/src/i18n/locales/en.json`
- `apps/web/src/i18n/locales/sv.json`

Required UX structure:

- scenario selector/navigation
- top KPI strip
- editable assumptions and planning controls
- investment editor
- risk presets and comparison
- charts/results section
- report-creation readiness controls

Must preserve:

- scenario list/create/delete/update
- explicit compute behavior
- stale compute token handling
- fee sufficiency outputs
- risk preset behavior
- base vs stress comparison
- report creation gating
- depreciation/class allocation behavior

How this phase differs from the mockup:

- less static dashboard emphasis
- stronger editing affordances
- clearer distinction between inputs and outputs
- no hiding of important advanced controls behind visual simplification

Potential pitfalls:

- making KPI cards dominate the page too much
- pushing editor controls too far below the fold
- breaking scenario readiness/report gating cues

Definition of done for this phase:

- scenario editing remains primary
- pricing sufficiency and risk outputs are easier to understand
- user can move from assumptions to investments to outcomes naturally
- compute/report actions remain explicit and safe

## Phase 3: Reports Refresh

Goal:
Refresh Reports into a clearer publication surface with stronger provenance and variant clarity.

Primary files:

- `apps/web/src/v2/ReportsPageV2.tsx`
- `apps/web/src/v2/v2.css`
- `apps/web/src/api.ts`
- `apps/web/src/i18n/locales/fi.json`
- `apps/web/src/i18n/locales/en.json`
- `apps/web/src/i18n/locales/sv.json`

Possible API touchpoint:

- `apps/api/src/v2/v2.service.ts` only if presentation needs a missing field that cannot be derived safely on the client

Required UX structure:

- report list and selection
- report summary KPIs
- baseline source/provenance summary
- variant clarity
- included-section clarity
- export actions

Must preserve:

- current report list/detail behavior
- current snapshot-based report model
- current public/confidential variant behavior
- current PDF download behavior

Key improvements beyond the mockup:

- make variant consequences explicit, not just tagged
- reduce clutter in report detail
- show provenance in a concise, defensible format
- keep the page feeling publish-ready

Potential pitfalls:

- overloading the detail view with duplicate scenario info
- creating UI language that implies variant behavior the backend does not support
- making provenance too subtle

Definition of done for this phase:

- user understands what report they are looking at
- user understands what can be safely shared
- provenance is clear enough to defend the report externally

## Phase 4: Shared Alignment Pass

Goal:
Unify the three refreshed screens once all of them exist.

Primary files:

- `apps/web/src/v2/AppShellV2.tsx`
- `apps/web/src/v2/v2.css`
- `apps/web/src/App.css`
- locale files as needed

Tasks:

- normalize spacing and typography across screens
- align section header patterns
- align card/table density
- align badge semantics
- check mobile/tablet behavior
- remove one-off styles introduced during earlier phases

## Phase 5: Hardening Pass

Goal:
Stabilize the refreshed UI before calling it done.

Tasks:

- web typecheck
- relevant V2 web tests
- locale integrity tests
- add targeted regression tests for UI states that changed materially
- keyboard and focus checks for major controls
- loading/error/empty state review
- cleanup of dead CSS or stale helper code

## Cross-phase verification checklist

After each phase:

- `pnpm --filter ./apps/web typecheck`
- relevant `pnpm --filter ./apps/web test -- src/v2`
- locale integrity test when strings change
- quick manual scan of untouched V2 screens for accidental style regressions

## Scope boundaries

In scope:

- V2 shell and the three V2 screens
- styles, layout, presentation, copy clarity
- small client-side refactors that make the new UI maintainable

Out of scope unless forced:

- projection math changes
- report pipeline redesign
- auth/login redesign
- new backend features unrelated to supporting current UI states
- non-V2 legacy page redesign

## Resume guide

If work pauses between screens:

- resume from the next unfinished phase in this file
- re-check current screen against its "definition of done"
- do not start the next screen until the active screen is visually coherent and behavior-safe
- prefer deleting temporary styling hacks before moving on
