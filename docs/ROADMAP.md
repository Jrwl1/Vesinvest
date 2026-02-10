# Roadmap

Last updated: 2026-02-10

Planning baseline for V1:
- Single-tenant delivery per customer: one web app, one API, one Postgres DB.
- Canonical precedence: code reality, then latest customer facts in `docs/client`, then `docs/DECISIONS.md`.
- This roadmap is planning-only and does not change product code.

## M0: Lock V1 scope with customer

**Status:** In progress.

**Done criteria:**
1. Customer goals, constraints, and must-haves are confirmed.
2. Open questions (VAT, tariff model, connections, output format, timeline) have explicit answers or explicit deferrals.
3. V1 scope in/out is signed off and copied into `docs/PROJECT_STATUS.md`.

**Scope:**
- Validate customer documents against current code capabilities.
- Freeze acceptance criteria for V1 in testable form.
- Confirm first pilot customer path.

**Out of scope:** Product implementation.

**Dependencies:** Customer decision meeting and document confirmation.

## M1: Deployable single-tenant platform baseline (Render)

**Status:** Planned.

**Done criteria:**
1. App+DB-per-customer deployment playbook is approved.
2. Environment/secrets checklist is approved.
3. Backup/restore and migration policy are approved.
4. Release checklist is approved.

**Scope:**
- Runtime/deploy architecture for one customer tenant.
- Operational controls for safe releases.

**Out of scope:** Feature expansion.

**Dependencies:** M0 complete.

## M2: Functional V1 parity with customer must-haves

**Status:** Planned.

**Done criteria:**
1. Accepted V1 data contract is represented in import and projection flows.
2. Acceptance criteria for required planning outputs pass on pilot data.
3. Any deferred requirements are marked as post-V1 with rationale.

**Scope:**
- Close capability gaps between current code and approved V1 requirements.

**Out of scope:** Nice-to-have analytics and non-required exports.

**Dependencies:** M0 and M1 complete.

## M3: Security and release-readiness gate

**Status:** Planned.

**Done criteria:**
1. Minimum V1 security bar is met and evidenced.
2. Smoke/E2E release gates are defined and passing on staging.
3. Manual go-live gate and rollback path are documented.

**Scope:**
- Threat-driven controls and release quality gates.

**Out of scope:** Long-term compliance programs beyond V1.

**Dependencies:** M1 and M2 complete.

## M4: Pilot customer handover

**Status:** Planned.

**Done criteria:**
1. Pilot tenant is live with approved configuration.
2. Customer acceptance checklist is signed off.
3. Post-launch backlog is prioritized for next cycle.

**Scope:**
- Controlled customer go-live and handover.

**Out of scope:** Multi-customer shared deployment.

**Dependencies:** M3 complete.

## Explicitly out of V1 unless customer escalates

1. Multi-budget comparison UX.
2. Regulatory export format (for example FACIT) before requirement lock.
3. Advanced RBAC and legacy module consolidation.
