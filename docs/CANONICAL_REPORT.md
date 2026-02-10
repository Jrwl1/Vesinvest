# CANONICAL_REPORT (V1 planning pass)

Date: 2026-02-10
Mode: planning only (no product code changed)

## Why this update was run

Customer clarifications changed V1 scope materially. This pass updates canonical planning docs so the repo plan matches those clarifications.

## Customer clarifications integrated

1. VAT is 0% for V1 and must not be part of calculations.
2. Base fee is manual annual total with yearly percent change/override.
3. Connection fees are not required in V1.
4. Investment horizon must be at least 20 years.
5. Depreciation must be split: baseline vs investment-driven addition.
6. PDF export must answer financing/cashflow question using diagram + compact table.

## What changed and why

- `docs/CANONICAL.md`
  - Marked `docs/ROADMAP.md` as the one canonical V1 plan doc.
  - Kept older import-plan docs as non-canonical references.
  - Added explicit planning flow and conflict resolution with latest customer clarifications.
- `docs/PROJECT_STATUS.md`
  - Replaced draft scope with clarified V1 scope, acceptance criteria, and short customer-facing open questions.
- `docs/ROADMAP.md`
  - Reworked milestones to include hosted deployment, PDF cashflow export, and security audits both during build and before release.
- `docs/BACKLOG.md`
  - Reorganized backlog to match clarified V1: VAT-free model, depreciation split, PDF financing export, hosted ops, security gates.
- `docs/SPRINT.md`
  - Updated to a concrete 12-week sprint (max 5 items) aligned with clarified V1 outcome.
- `docs/DECISIONS.md`
  - Appended ADR entries for VAT-free calculations, base fee model, depreciation split, PDF export, connections out of scope, and single-tenant hosted deployment.
- `docs/WORKLOG.md`
  - Appended exactly one PLAN entry for this run.

## Conflict resolution decisions

| Conflict | Canonical winner | Why |
|---|---|---|
| Earlier open VAT/base-fee/connection assumptions vs customer clarification | Customer clarification + ADR updates | Customer clarified business rules for V1. |
| Multiple import-plan documents in repo | `docs/ROADMAP.md` as canonical plan, others non-canonical | Single execution plan is required to avoid drift. |
| Historical deployment docs vs V1 hosted target | Updated roadmap/status + existing code reality | V1 must be hosted and operable for customer use. |
| "Everything on one PDF page" impulse vs usability | Financing-focused multi-page PDF allowed | Customer asked for readable cashflow decision support. |

## V1 definition locked in this pass

In scope:
- Hosted single-tenant delivery per customer.
- VAT-free V1 calculations.
- Manual annual base-fee model with yearly adjustments.
- 20-year minimum investment horizon.
- Depreciation split (baseline + investment-driven additional).
- PDF financing export (cashflow diagram + compact table).
- Security checks in build phase and final pre-release audit.

Out of scope for V1:
- Dedicated connection-fee model (manual other income if needed).
- Multi-budget comparison UX.
- Broader regulatory export set beyond agreed PDF scope.

## Minimal open questions to customer (plain Swedish)

1. Vilket arligt resultatmal vill ni minst uppna i planen?
2. Vill ni se PDF-resultatet totalt eller separat for vatten och avlopp?
3. Vilket ar ska 20-arsplanen starta fran i forsta leveransen?
4. Vem hos er godkanner slutlig V1-rapport fore drift?
5. Hur ofta vill ni uppdatera grundavgiften i praktiken (en gang per ar eller vid behov)?
