# Project status

Last updated: 2026-02-10

## Goal

Deliver a customer-ready V1 as a hosted service for one customer at a time, with clear financial decision support.

## Active milestone

**M0: Scope lock and acceptance lock** (see `docs/ROADMAP.md`).

## Current state

- Core budget/import/projection flows exist in code and are usable as V1 base.
- V1 business rules are now clarified by customer: VAT-free, manual base fee model, no dedicated connection-fee model, minimum 20-year horizon.
- Depreciation reporting in V1 must show two parts separately: baseline and investment-driven additional depreciation.
- Export direction is clarified: PDF must function as financing/cashflow decision support, not a one-page data dump.
- Deployment target remains hosted single-tenant per customer with security gates.

## V1 definition (locked for planning)

**In scope:**
- Hosted single-tenant customer delivery.
- VAT-free calculations (0%).
- Base fee as annual total plus yearly percent change/override.
- Investment horizon minimum 20 years.
- Separate baseline vs investment-driven depreciation view.
- PDF cashflow export (diagram + compact table).
- Security audit in build phase and final pre-release audit.

**Out of scope for V1:**
- Dedicated connection-fee model.
- Multi-budget comparison UX.
- Wider regulatory export family before V1 acceptance.

## V1 is done when

1. Roadmap milestones M0-M5 are completed with evidence.
2. Financial rules above are documented, accepted, and used as canonical planning assumptions.
3. Hosted deployment playbook, backup/restore, and release gate checklist are approved.
4. PDF financing report format is approved by customer and included in acceptance criteria.

## Korta fragor till kund (max 5)

1. Vilket arligt resultatmal vill ni minst uppna?
2. Vill ni se PDF totalt eller separat for vatten och avlopp?
3. Vilket ar ska 20-arsplanen starta fran i forsta leveransen?
4. Vem hos er godkanner slutlig rapport fore drift?
5. Hur ofta vill ni normalt justera grundavgiften?

## Next 5 actions

1. Confirm customer answers to the five open questions above.
2. Freeze acceptance criteria and map each to backlog tasks.
3. Finalize hosted deployment and operations checklist for pilot tenant.
4. Finalize security checklists for build-time and pre-release audit.
5. Finalize PDF cashflow report acceptance checklist and signoff flow.

## Key links

- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
