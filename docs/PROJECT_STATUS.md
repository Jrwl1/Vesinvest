# Project status

Last updated: 2026-03-16

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- The wizard/freshness/depreciation queues through `S-73` are accepted; the remaining gap is no longer a narrow card-alignment task.
- Customer requirements plus the real 2024 statement-PDF audit now point to one larger target: a full frontend overhaul across wizard, statement correction, Forecast, and Reports.
- Live proof showed that a real customer PDF can correct year 2024 in-browser and move its result profile from an implausible VEETI-only `+133 981` toward a much more plausible `+3 691`.
- The current product still has four blocking UI gaps: mixed-language trust leaks, weak wizard truth/state gating, a hidden/convoluted statement-correction path, and a Forecast information architecture that is too dense and too disconnected from investment/depreciation planning.
- The active queue is therefore `S-74..S-85`: shell/design-system truth, year trust contract, trust-first intake, full manual + statement correction, strict baseline gate, CFO-first Forecast landing, progressive investment planning, integrated depreciation strategy, Reports provenance alignment, final accessibility/locale cleanup, and full live proof.

## Top blockers

1. Shared shell, wizard, and Forecast scaffolding still leak mixed language and inconsistent status semantics.
2. The wizard still lacks a first-class trust model for technically complete but economically suspicious years.
3. Statement-PDF correction works, but the current flow is too hidden and indirect for real customer use.
4. Forecast still opens too dense, and future investments plus depreciation do not yet read as one planning workflow.

## Next actions

1. Execute `S-74` to lock shell truth, shared vocabulary, and the shared status/badge system.
2. Execute `S-75..S-79` to rebuild the wizard around trust-first intake, full manual/statement correction, and a strict planning-baseline gate.
3. Execute `S-80..S-83` to rebuild Forecast, investments, depreciation, and Reports to the approved canon.
4. Execute `S-84` for final accessibility, responsiveness, and locale cleanup.
5. Close with `S-85` by re-running the full live audit, including the real 2024 statement-PDF correction path.

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
