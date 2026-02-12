# Project status

Last updated: 2026-02-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Sprint queue S-01..S-05 for KVA import. S-01..S-05 DONE. KVA import queue complete.

## Top blockers

1. Historical-year detection by sheet styling may be unreliable across workbooks; fallback rule must be deterministic.
2. Customer TBD items `B-TBD-01..B-TBD-05` remain open for final acceptance lock, non-blocking for sprint start.

## Next 5 actions

1. M0 completion: customer-locked V1 facts, KVA Excel import agreed scope delivered.
2. PLAN pass to refresh sprint queue (S-06+ or new epic).
3. B-405: Release-gate hardening (lint/typecheck must pass with no exemptions).

## Customer TBD tracking

Customer-owned unknowns are tracked in `docs/BACKLOG.md` as `B-TBD-01..B-TBD-05`.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
