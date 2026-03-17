# Roadmap

Last updated: 2026-03-17

Planning baseline for V1:

- Hosted single-tenant per customer (one web app + one API + one DB).
- V1 calculations are VAT-free.
- Financial decision support is the core outcome.
- Security checks are required during build and before release.

## M0: Lock V1 scope and operating contract

**Status:** In progress.

**Done criteria:**

1. Customer-locked V1 facts are reflected in canonical docs.
2. AGENTS mode router and PLAN/DO/RUNSPRINT/REVIEW contracts are deterministic, including `git status --porcelain` clean-tree semantics, PLAN dirty-tree baseline handling, DO scoped dirty-baseline absorption when pre-existing dirt is already inside the selected substep scope, bounded same-package gate fixes for required verification fallout, pre-product-commit hygiene classification, explicit `HARD BLOCKED` versus `GATE BLOCKED` handling, product-scope DO writes for sprint-listed non-canonical docs/config examples, bounded native helper-agent usage under parent ownership, no recursive or parallel helper streams, and direct MCP preference for evidence and verification.
3. Sprint format is executable, evidence-driven, and gate-aware when new verification is tightened.
4. KVA Excel import + Talousarvio baseline are locked (Option A, `KVA totalt` single-source import, historical-only Talousarvio). The broader frontend-overhaul queue through `S-86` is accepted, and the `Yhteenveto` perfection queue `S-87..S-92` is accepted too. The current execution target in `docs/SPRINT.md` is now a setup year-intake modernization queue `S-93..S-98`: make step 2 action-first, rewrite the copy into short literal guidance, restyle ready/suspicious/blocked years into a compact high-trust board, expose direct price/volume repair from the cards, add per-year QDIS PDF import for values that sit above VEETI provenance, and close with a live audit using the real 2022 QDIS export PDF.

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
