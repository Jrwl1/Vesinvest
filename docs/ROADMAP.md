# Roadmap

Last updated: 2026-02-10

Planning baseline for V1:
- Hosted single-tenant per customer (one web app + one API + one DB).
- V1 calculations are VAT-free.
- Financial decision support is the core outcome, including PDF cashflow export.
- Security checks are required during build and again before release.

## M0: Lock V1 scope and acceptance with customer

**Status:** In progress.

**Done criteria:**
1. Customer clarifications are reflected in canonical docs.
2. V1 in-scope/out-of-scope is approved.
3. Acceptance criteria are testable and signed off.

**Scope:**
- Translate customer clarifications into explicit V1 rules.
- Confirm open business questions in plain language.

**Dependencies:** Customer confirmation meeting.

## M1: Financial model policy lock for V1

**Status:** Planned.

**Done criteria:**
1. VAT-free (0%) policy is documented as mandatory for V1 calculations.
2. Base-fee model is documented as annual total + yearly change/override.
3. Connection fees are documented as out of V1 scope.
4. 20-year minimum investment horizon is documented.
5. Depreciation split requirement (baseline + investment-driven additional) is documented.

**Scope:**
- Lock financial assumptions and boundary conditions for V1.

**Dependencies:** M0 complete.

## M2: Hosted single-tenant deployment and ops baseline

**Status:** Planned.

**Done criteria:**
1. Per-customer hosted deployment playbook is approved.
2. Secrets/env, backup/restore, and migration policy are approved.
3. Smoke test and rollback checklist are approved.

**Scope:**
- Customer-deployable hosted baseline (not local-only operation).

**Dependencies:** M1 complete.

## M3: PDF cashflow export milestone

**Status:** Planned.

**Done criteria:**
1. PDF specification answers: "Do prices cover future costs + investments?"
2. Report format includes cashflow diagram + compact table.
3. Multi-page layout is accepted when needed for readability.
4. Customer signs off report structure as V1 acceptance artifact.

**Scope:**
- Financing-focused export deliverable for customer decision-making.

**Dependencies:** M1 complete.

## M4: Security assurance milestone

**Status:** Planned.

**Done criteria:**
1. Build-time security checklist is completed and evidenced.
2. Final pre-release security audit checklist is completed and evidenced.
3. Ownership/accountability map for security-critical areas is explicit.

**Scope:**
- Security quality gate during build and before production release.

**Dependencies:** M2 complete.

## M5: Pilot go-live and handover

**Status:** Planned.

**Done criteria:**
1. Pilot tenant is deployed as hosted service.
2. Acceptance criteria pass, including PDF cashflow output review.
3. Customer signoff and post-launch backlog are documented.

**Scope:**
- Controlled V1 launch for first customer tenant.

**Dependencies:** M3 and M4 complete.

## Explicitly out of V1

1. Dedicated connection-fee engine.
2. Multi-budget comparison UX.
3. Additional regulatory export variants before pilot acceptance.
