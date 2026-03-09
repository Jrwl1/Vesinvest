# Roadmap

Last updated: 2026-03-08

Planning baseline for V1:

- Hosted single-tenant per customer (one web app + one API + one DB).
- V1 calculations are VAT-free.
- Financial decision support is the core outcome.
- Security checks are required during build and before release.

## M0: Lock V1 scope and operating contract

**Status:** In progress.

**Done criteria:**

1. Customer-locked V1 facts are reflected in canonical docs.
2. AGENTS mode router and PLAN/DO/RUNSPRINT/REVIEW contracts are deterministic.
3. Sprint format is executable and evidence-driven.
4. KVA Excel import + Talousarvio baseline are locked (Option A, `KVA totalt` single-source import, historical-only Talousarvio). Ennuste page is functionally complete per `docs/PROJECTION_UX_PLAN.md`. Current execution target is the active variable-length queue in `docs/SPRINT.md` (`S-26..S-30` today), where Overview is accepted and the remaining work continues in Forecast refresh, Reports refresh, shared alignment, and final hardening.

**Dependencies:** Customer clarification baseline and canonical consistency.

## M1: Lock financial model policy for V1

**Status:** Planned.

**Done criteria:**

1. VAT-free policy is locked.
2. Base fee model is locked as annual total + yearly change/override.
3. Connection fees are explicitly out of V1 scope.
4. Minimum 20-year horizon is locked.
5. Depreciation split requirement is locked.

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

1. PDF answers whether pricing covers future costs + investments.
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

1. Dedicated connection-fee engine.
2. Multi-budget comparison UX.
3. Additional regulatory export variants before pilot acceptance.
