# Roadmap

Last updated: 2026-04-27

Planning baseline for V1:

- Hosted single-tenant per customer (one web app + one API + one DB).
- V1 calculations are VAT-free.
- Financial decision support is the core outcome.
- Security checks are required during build and before release.
- The renewed Water Services Act direction changes the product path from single-price sufficiency to a defendable asset-management-to-tariff workflow: trusted baseline -> asset management plan -> forecast -> tariff plan -> reports.
- Pricing work must account for the full fee package, not only combined usage price: `liittymismaksu`, `perusmaksu`, water usage price, and wastewater usage price.
- The investment plan belongs under a dedicated asset-management planning environment; Overview remains the trusted historical baseline and VEETI/manual evidence desk.

## M0: Lock V1 scope and operating contract

**Status:** In progress.

**Done criteria:**

1. Customer-locked V1 facts are reflected in canonical docs.
2. The root `AGENTS.md` is a short harness map, not an AIOS command router; durable operating knowledge lives in indexed docs and executable checks.
3. Execution plans under `docs/exec-plans/` replace active sprint rows for durable multi-step work; accepted history stays historical and is not default execution context. Backlog is a user-owned optional parking lot, not a default execution or planning input.
4. KVA Excel import + Talousarvio baseline are locked (Option A, `KVA totalt` single-source import, historical-only Talousarvio). The selective repair, Forecast hardening, CFO-readiness, visual-overhaul, post-audit interaction queue, and residual cleanup through `S-141` are accepted in scope: workbook-backed year repair, explicit 2024 mixed-source ownership, `Investointiohjelma`, PTS-derived `Poistosaannot`, reset cleanliness, explicit Step 3 approval, mapped depreciation compute, cumulative-cash-first funding hierarchy, Forecast report-freshness truth, reset-to-PDF live audit, shared modern-trust visual system, wizard back navigation, parked-year state, value-led review summaries, true row-local step-2 editing, card-native step-3 review, lightweight row-save refresh, linked-workspace prefetch scoping, and task-first login hierarchy all passed.
5. The security/performance remediation queue `S-149..S-155` is accepted, while `S-156` remains a deployment-only header-verification hold that cannot be closed from this workspace; the frontend trust/interaction and login/year-card follow-up rows `S-157..S-183` and prod-first correction queue `S-184..S-192` are accepted history.
6. The customer-facing workflow from login through VEETI connect, year import, year review, planning-baseline creation, and on to Forecast/Reports must remain unchanged in meaning while those fixes land: `Yhteenveto` remains a VEETI verification surface, `Ennuste` owns planning and depreciation behavior, live route/readiness truth must match backend scenario state, report-readiness gating stays truthful, and the 20-year planning model from customer source docs remains intact.

**Dependencies:** Customer clarification baseline and canonical consistency.

## M1: Lock asset-management and tariff policy for V1

**Status:** Planned.

**Done criteria:**

1. VAT-free policy is locked.
2. Asset management plan workflow is locked as the owner of `Investointiohjelma`, depreciation classes, service splits, renewal backlog, and physical investment rationale.
3. Tariff plan workflow is locked as the owner of fee-package updates across `liittymismaksu`, `perusmaksu`, water usage price, and wastewater usage price.
4. Minimum 20-year horizon is locked.
5. Depreciation split requirement is locked.
6. V1 pricing output can stay planning-grade, but it must explain how the required funding need is allocated across fee types rather than presenting only one combined required price.

**Dependencies:** M0 complete.

## M2: Hosted deployment and operations baseline

**Status:** Planned.

**Done criteria:**

1. Per-customer hosted deployment runbook is approved.
2. Secrets/env, backup/restore, and migration policy are approved.
3. Smoke-test and rollback checklist are approved.

**Dependencies:** M1 complete.

## M3: PDF cashflow export acceptance

**Status:** Planned.

**Done criteria:**

1. PDF answers whether the proposed fee package covers future costs + investments.
2. Report contains cashflow diagram + compact table.
3. Multi-page layout is allowed for readability.
4. Customer signs off PDF acceptance criteria.

**Dependencies:** M1 complete.

## M4: Security assurance gates

**Status:** Planned.

**Done criteria:**

1. Build-time security checklist completed.
2. Pre-release security audit checklist completed.
3. Security ownership/accountability map approved.

**Dependencies:** M2 complete.

## M5: Pilot go-live and handover

**Status:** Planned.

**Done criteria:**

1. Pilot tenant deployed as hosted service.
2. Acceptance criteria pass, including PDF cashflow acceptance.
3. Customer signoff and post-launch backlog are documented.

**Dependencies:** M3 and M4 complete.

## Explicitly out of V1

1. Billing-system-grade tariff administration beyond the defendable planning recommendation.
2. Multi-budget comparison UX.
3. Additional regulatory export variants before pilot acceptance.
