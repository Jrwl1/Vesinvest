# Project status

Last updated: 2026-03-16

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Post-audit trust hardening `S-31..S-36`, the wizard rollout/corrective queues `S-37..S-47`, the wizard UX-coherence queue `S-48..S-52`, the power-user Forecast queue `S-53..S-58`, the wizard trust-first queue `S-59..S-63`, and the wizard review-loop completion queue `S-64..S-68` are all completed and accepted.
- The current wizard now keeps to setup scope much better: technically ready years can be approved without edits, review mode comes before edit mode, and the wiped-workspace audit reached step 6 successfully.
- The next gap is the accounting model of import/review cards. Step-2 cards still foreground `Liikevaihto`, prices, and volumes instead of the customer’s key `Ennuste` rows.
- Current code does not expose a distinct `Materialkostnader` field in the import-year preview model; the imported-year financial shape is still `Liikevaihto`, `Henkilostokulut`, and `LiiketoiminnanMuutKulut`, so a new summary mapping or contract is needed before the cards can match the customer’s planning rows truthfully.
- Step-2 cards still label technically importable VEETI years too strongly before human review, and they still carry a low-value technical helper line instead of showing more of the raw economic shape.
- The next queue should therefore stay inside setup and align the import/review cards with the customer’s accounting mental model instead of adding interpretive badges or drifting into broader Forecast behavior.

## Top blockers

1. Step-2 import cards still foreground the wrong business summary for the customer’s validation workflow.
2. The current import-year data shape does not directly expose all customer-priority `Ennuste` rows, especially a distinct `Materialkostnader` value.
3. Technically importable VEETI years are still labeled too strongly in step 2 before human review.

## Next actions

1. Execute `S-69` to add a truthful import-year summary model aligned to the customer’s `Ennuste` rows and the available current code/data.
2. Execute `S-70..S-72` to rework step-2/step-3 card content and terminology so users validate raw accounting shape instead of inferred readiness.
3. Close with `S-73` by re-running the wizard audit against the original setup-scope lock.

## Customer TBD tracking

Customer-owned unknowns remain tracked in `docs/BACKLOG.md` as `B-TBD-01..B-TBD-05`.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
