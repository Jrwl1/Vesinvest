# Project status

Last updated: 2026-03-24

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The security/performance remediation queue `S-149..S-156` remains accepted history except for the deployment-only `S-156` header-verification hold.
- `S-157..S-175` are now accepted history. The latest live audit on March 24, 2026 reset Kronoby, imported `2022..2026`, repaired the needed years, created the planning baseline, opened `Ennuste`, and confirmed the next local target is a broader `Yhteenveto`/`Ennuste` information-architecture reset rather than another small wizard cleanup.
- The current local planning target is `S-176..S-183`: keep `Yhteenveto` as the VEETI verification home, redesign `Ennuste` with the chosen Signal Grid direction, replace year-mapped depreciation UX with org-wide `Poistosuunnitelmat` defaults plus item-level class/rule snapshots, and finish with a full live re-audit in the same manner as the original browser audit.
- Current code reality already contains org-level depreciation rule storage, scenario-scoped rule variants, and class-allocation compute support; the gap is the user-facing contract and the lack of item-level class/snapshot behavior on investment entry.
- The current local execution surface now spans `apps/web/src/v2/**` and the directly coupled `apps/api/src/v2/**`, `apps/api/src/projections/**`, and scenario storage contracts needed to make forecast/depreciation truth visible and stable.

## Top blockers

1. `Yhteenveto` still behaves like a setup epilogue after baseline creation instead of a fast VEETI verification board with one dominant next action.
2. Step-2 and step-3 year-card state can contradict backend truth after manual repair/import flows, which breaks trust in the imported years.
3. `Ennuste` is overloaded: scenario setup, KPI story, planning controls, depreciation, and zero-state guidance all compete on one long page.
4. `Poistosuunnitelmat` currently feels like year mapping instead of simple class-based defaults plus per-investment inheritance/override.
5. `S-156` remains a deployment-only header-verification hold outside this workspace.

## Next actions

1. Execute `S-176..S-177` to turn `Yhteenveto` back into a trustworthy VEETI verification surface and eliminate year-card state contradictions.
2. Execute `S-178..S-182` to reset `Ennuste` hierarchy, make `Poistosuunnitelmat` an org-default class library inside `Ennuste`, and require an effective depreciation rule before saving an investment.
3. Execute `S-183` as a final live audit in the same manner as the original March 24, 2026 audit: reset Kronoby, import five years, repair where needed, create baseline, enter `Ennuste`, and verify the touched flow end to end.

## Customer TBD tracking

No customer-owned TBD items are currently parked in the main backlog.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/DECISIONS.md`
