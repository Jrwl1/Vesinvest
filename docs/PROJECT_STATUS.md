# Project status

Last updated: 2026-04-27

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M1: Asset-management and tariff policy lock** (see `docs/ROADMAP.md`).

## Current state

- The repo operating model has moved from the former AIOS command protocol to harness engineering: short agent map, indexed docs, executable plans, and mechanical checks.
- The live route/readiness and V2 surface recovery queue `S-184..S-192` is accepted history.
- The next product direction is driven by renewed Water Services Act guidance: the app must connect asset-management planning to a defendable tariff package, not only compute one required combined water price.
- `Yhteenveto` remains the trusted historical baseline and VEETI/manual evidence desk.
- `Ennuste` remains the forecast and scenario computation environment, but `Investointiohjelma` should graduate into a dedicated asset-management planning environment rather than stay as one step inside Overview.
- A new pricing/tariff environment is needed to update and justify `liittymismaksu`, `perusmaksu`, water usage price, and wastewater usage price together.
- Existing code already has planning primitives for Vesinvest plans, project allocations, depreciation classes, fee recommendations, baseline fingerprints, and scenario fingerprints; the next planning pass must turn those primitives into a coherent IA and contract.

## Top blockers

1. Canonical IA must be updated from Overview -> Forecast -> Reports to Overview -> Asset Management Plan -> Forecast -> Tariff Plan -> Reports.
2. The tariff model must decide what is planning-grade V1 scope versus billing-grade tariff administration.
3. The older "connection fees out of V1" decision is superseded for planning recommendations: connection fees are not a full billing engine, but they must be represented in the fee-package story.
4. `S-156` remains a deployment-only header-verification hold outside this workspace.

## Next actions

1. Create an execution plan under `docs/exec-plans/active/` to materialize the asset-management and tariff-path IA.
2. Scope the data contract for fee-package recommendations across `liittymismaksu`, `perusmaksu`, water usage price, and wastewater usage price.
3. Decide whether the investment-plan environment is a new top-level workspace or a renamed/expanded Vesinvest workspace inside the current V2 shell.

## Customer TBD tracking

No customer-owned TBD items are currently parked in the main backlog.

## Key links

- `AGENTS.md`
- `docs/index.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/exec-plans/index.md`
- `docs/DECISIONS.md`
