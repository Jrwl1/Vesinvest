# Project status

Last updated: 2026-03-21

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The `OverviewPageV2` decomposition queue `S-142..S-148` is accepted and closed.
- The current execution target is the security/performance remediation queue `S-149..S-156`.
- Customer source material still anchors the product on three real result statements, explicit year review, 20-year investment planning, and depreciation derived from the freshest booked year plus future investments.
- Current audit evidence shows the remaining high-signal gaps are upload/parser hardening, trusted-IP/shared auth throttling, request-path query reduction, and first-authenticated-load bundle/header hardening.
- The current V2 workflow remains Overview -> Forecast -> Reports; remediation must preserve explicit approval, provenance, freshness, depreciation visibility, and report-readiness truth while tightening runtime safety and responsiveness.

## Top blockers

1. Workbook preview/upload still uses vulnerable or weakly bounded dependencies (`xlsx`, `multer`) on user-supplied files.
2. Auth throttling still trusts spoofable forwarded headers and remains process-local instead of shared/edge-backed.
3. The authenticated web path still pulls heavy OCR/PDF/CSS work too early, and the frontend production header policy is not repo-visible yet.

## Next actions

1. Execute `S-149..S-156` top-to-bottom: upload boundary hardening, auth/rate-limit fixes, demo-key cleanup, auth/legal query reduction, bundle/CSS splits, header/release-gate hardening, and final re-audit.
2. Keep workflow truth stable while hardening: explicit approval, provenance, compute freshness, depreciation visibility, and report-readiness gating must not drift.
3. Re-run focused regressions, production-build checks, header verification, and a live browser audit before closing the queue.

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
