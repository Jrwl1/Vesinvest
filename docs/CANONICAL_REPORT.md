# CANONICAL_REPORT (V1 planning pass)

Date: 2026-02-10  
Mode: planning only (no product code changed)

## Scope of this pass

- Build a realistic customer-ready V1 plan.
- Reconcile docs against code reality and latest customer sources.
- Update only planning docs and canonical references.

## Sources consulted

- Planning system: `docs/CANONICAL.md`, `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`, `docs/BACKLOG.md`, `docs/SPRINT.md`, `docs/WORKLOG.md` (tail), `docs/DECISIONS.md`.
- Customer facts: `docs/client/*.docx`, `docs/client/*.xlsx`.
- Code reality anchors: budgets/import/projection/auth/tenant modules and Prisma schema.

## Conflict resolution decisions

| Conflict | Canonical winner | Why |
|---|---|---|
| Old planning docs vs current behavior | Code + current canonical docs | Implemented behavior must define as-is truth. |
| Customer requirement vs current capability | Customer docs define target; code defines as-is | V1 plan must show gaps explicitly, not invent implementation. |
| Historical Railway/Vercel deployment notes vs V1 delivery request | V1 planning docs (Render single-tenant) | This pass is scoped to customer-deliverable V1 planning. |
| Multi-tenant assumptions vs explicit instruction | Single-tenant per customer | Explicit user/customer instruction for this cycle. |
| Ambiguous or missing facts (VAT, connection model, output format) | `TBD` with explicit confirmation request | Prevents hidden assumptions. |

## As-is capability summary (verified)

- KVA import preview/confirm is implemented and persists budget + valisummat + revenue drivers.
- Budget UI supports valisummat fallback when account lines are absent.
- Projection and assumptions flows are present.
- JWT + org-scoped tenant guards are present.
- Demo/dev bypass paths exist and must be disabled in production runtime.

## V1 definition (current draft)

In scope:
- Single-tenant deployable runtime per customer (Render app+DB pattern).
- Customer must-haves from source docs: baseline financial data handling, planning controls, pricing scenario support, investment/depreciation support.
- Security minimum bar and release gate checklist.

Out of scope unless escalated:
- Multi-budget comparison UX.
- Regulatory export format before requirement lock.
- Full RBAC and legacy module consolidation.

## Open questions requiring customer decision

1. VAT handling for water/wastewater pricing.
2. Final tariff model details (including base fee logic changes).
3. Whether connection data/fees are mandatory in V1.
4. Required investment horizon detail (full 20 years now vs phased).
5. Required first pilot output format (screen, CSV, PDF, regulatory).

## Notes on non-canonical docs

Historical "perfect/full/pivot" planning files remain non-canonical and are kept for traceability only. Current execution must follow `PROJECT_STATUS -> ROADMAP -> SPRINT -> BACKLOG`.

