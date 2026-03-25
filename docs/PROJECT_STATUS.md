# Project status

Last updated: 2026-03-25

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The security/performance remediation queue `S-149..S-156` remains accepted history except for the deployment-only `S-156` header-verification hold.
- `S-157..S-183` are now accepted history, but the March 25, 2026 live prod audit proved the shipped result still misses the real product bar on the surfaces users actually hit first.
- Production currently serves new bundles but still shows the old authenticated wizard/review UI, and `GET /v2/forecast/scenarios` can return a real scenario while the frontend still routes `/forecast` back into setup.
- The active local target is now `S-184..S-192`: recover live route/readiness truth first, then redesign the actual live wizard and forecast surfaces around the intended `Yhteenveto` verification desk and `Ennuste` operator board.
- Current code reality still contains org-level depreciation defaults, scenario-scoped rule variants, and compute support for class-based depreciation, but live product truth is broken by frontend gating and by overgrown wizard/forecast layouts.
- The current local execution surface spans `apps/web/src/v2/**`, the directly coupled `apps/api/src/v2/**`, `apps/api/src/projections/**`, and the scenario/depreciation storage contracts needed to make forecast access and forecast outputs truthful on live prod.

## Top blockers

1. Live prod route/access truth is broken: `/forecast` can bounce the user back into setup even when backend scenario state already exists.
2. The live wizard states users actually hit first are still the old tall, repetitive, rail-heavy layouts instead of one-screen primary tasks.
3. `Yhteenveto` is still not a verification desk on prod; the current shipped states still repeat summary blocks and helper copy instead of centering the year cards.
4. `Ennuste` is still either unreachable from live prod state or still too vertically stacked to function as a real operator board.
5. `Poistosuunnitelmat` still needs the simpler org-default + one-class-per-investment mental model to become understandable.
6. `S-156` remains a deployment-only header-verification hold outside this workspace.

## Next actions

1. Execute `S-184` immediately to fix live forecast route/access truth and make frontend readiness match backend baseline/scenario reality.
2. Execute `S-185..S-187` to recover the actual prod wizard and `Yhteenveto` surfaces into one-screen, verification-first layouts before any wider visual polish.
3. Execute `S-188..S-191` to rebuild the real `Ennuste` and `Poistosuunnitelmat` experience around the intended operator-board and item-level depreciation model.
4. Execute `S-192` as a final live re-audit on the same end-to-end prod flow, not just a local happy path.

## Customer TBD tracking

No customer-owned TBD items are currently parked in the main backlog.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/DECISIONS.md`
