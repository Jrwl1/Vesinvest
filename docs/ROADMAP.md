# Roadmap

Last updated: 2026-03-25

Planning baseline for V1:

- Hosted single-tenant per customer (one web app + one API + one DB).
- V1 calculations are VAT-free.
- Financial decision support is the core outcome.
- Security checks are required during build and before release.

## M0: Lock V1 scope and operating contract

**Status:** In progress.

**Done criteria:**

1. Customer-locked V1 facts are reflected in canonical docs.
2. AGENTS mode router and HUMANAUDIT/PLAN/RUNSPRINT contracts are deterministic, including exact-prefix protocol routing, session-scoped read-only audit intake with `OK GO` freeze plus later-`PLAN` sprint materialization, centralized shared-enforcement rules, explicit frontend copy-freeze policy, customer-doc reads only when the user explicitly directs PLAN to use named document(s) or extract specific information, PLAN code-localized blast-radius proof before sprint-row creation, `git status --porcelain` clean-tree semantics, bounded dirty-baseline absorption and same-package gate fixes during execution, bounded same-slice RUNSPRINT scope repair for planning misses, internal row acceptance inside RUNSPRINT, bounded native helper-agent usage under parent ownership, no recursive or parallel helper streams, and direct MCP preference for evidence and verification.
3. Sprint format is executable, evidence-driven, and active-only in its main file, with accepted history moved to archive docs instead of being kept inline. Backlog is a user-owned optional parking lot, not a default execution or planning input.
4. KVA Excel import + Talousarvio baseline are locked (Option A, `KVA totalt` single-source import, historical-only Talousarvio). The selective repair, Forecast hardening, CFO-readiness, visual-overhaul, post-audit interaction queue, and residual cleanup through `S-141` are accepted in scope: workbook-backed year repair, explicit 2024 mixed-source ownership, `Investointiohjelma`, PTS-derived `Poistosaannot`, reset cleanliness, explicit Step 3 approval, mapped depreciation compute, cumulative-cash-first funding hierarchy, Forecast report-freshness truth, reset-to-PDF live audit, shared modern-trust visual system, wizard back navigation, parked-year state, value-led review summaries, true row-local step-2 editing, card-native step-3 review, lightweight row-save refresh, linked-workspace prefetch scoping, and task-first login hierarchy all passed.
5. The security/performance remediation queue `S-149..S-155` is accepted, while `S-156` remains a deployment-only header-verification hold that cannot be closed from this workspace; the frontend trust/interaction and login/year-card follow-up rows `S-157..S-175` are accepted history, and the current locally executable target in `docs/SPRINT.md` is the broader `S-176..S-183` queue for the Signal Grid reset of `Yhteenveto` and `Ennuste`, truthful year-review state, org-wide `Poistosuunnitelmat` defaults, item-level depreciation class/snapshot behavior, and a final live re-audit.
6. The customer-facing workflow from login through VEETI connect, year import, year review, planning-baseline creation, and on to Forecast/Reports must remain unchanged in meaning while those fixes land: `Yhteenveto` remains a VEETI verification surface, `Ennuste` owns planning and depreciation behavior, explicit approval truth/provenance/freshness stay visible, report-readiness gating stays truthful, and the 20-year planning model from customer source docs remains intact.

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
