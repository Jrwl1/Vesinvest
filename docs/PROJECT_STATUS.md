# Project status

Last updated: 2026-03-23

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The security/performance remediation queue `S-149..S-156` remains accepted history except for the deployment-only `S-156` header-verification hold.
- `S-157..S-170` now remain done. The latest rerun verified the non-sticky V2 shell header, the more legible workspace chip, and the short exact edited-line labels on step-2 chosen year cards.
- A live browser audit on `http://127.0.0.1:5173` found the next local cleanup queue as `S-171..S-175`: step-3 copy parity, duplicate back/action cleanup, human-readable provenance, and visible-year-only prefetching.
- The audited flow was clean at the browser/runtime level: login, overview, context, report/scenario list, and visible year-data requests all returned `200`, with no app console errors in the audited path.
- The current local execution surface stays inside `apps/web` and remains frontend-led unless any copy/action cleanup proves impossible without widening the current browser-facing contract.

## Top blockers

1. Step-3 review cards still use the older verbose `corrected year differs from VEETI` sentence instead of the new short edited-line style already visible on step 2.
2. The wizard still duplicates back navigation and year-decision actions, especially in step-4 QDIS/year decision flows.
3. Step-2 cards still show machine-ish provenance/count copy, and the audited review flow still reached `GET /api/v2/import/years/2026/data` even though the visible workspace years were `2022..2024`.
4. `S-156` remains a deployment-only header-verification hold outside this workspace.

## Next actions

1. Execute `S-171` to propagate the short edited-line copy style into step-3 review cards and remove the leftover verbose sentence there.
2. Execute `S-172..S-174` to remove duplicate back/actions and trim machine-ish helper/provenance copy from the step-2 through step-4 flow.
3. Execute `S-175` to tighten year-data prefetching to visible/imported years only, then re-audit the reviewed-year request pattern.

## Customer TBD tracking

No customer-owned TBD items are currently parked in the main backlog.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/DECISIONS.md`
