# Backlog

Structured V1 work pool. `docs/SPRINT.md` is the active execution queue.

## Epic E1: OS hardening and deterministic execution

- B-101: Enforce strict PLAN/DO/REVIEW mode router in `AGENTS.md`.
- B-102: Align canonical precedence and file permissions with AGENTS contract.
- B-103: Keep sprint schema executable: Do/Files/Acceptance/Evidence/Stop/Status.
- B-104: Enforce concrete sprint evidence format in DO runs (commit hash + file paths + test/artifact output).
- B-105: Allow continuous DO->REVIEW execution loops until the whole sprint list is DONE, without requiring extra user prompts between runs. — DONE (implemented in `AGENTS.md`)

## Epic E2: V1 financial policy lock

- B-201: Keep VAT-free policy explicit and contradiction-free across canonical docs.
- B-202: Keep base-fee model explicit as annual total + yearly adjustment.
- B-203: Keep connection-fee model out of V1 scope.
- B-204: Keep minimum 20-year horizon explicit in acceptance criteria.
- B-205: Keep depreciation split explicit (baseline vs investment-driven additional).

## Epic E3: PDF financing export acceptance

- B-301: Define the exact V1 PDF cashflow question and success criteria.
- B-302: Define report structure (diagram + compact table).
- B-303: Define readability rules (multi-page allowed).
- B-304: Define customer signoff evidence for PDF acceptance.

## Epic E4: Hosted deployment and security gates

- B-401: Define hosted single-tenant deployment runbook per customer.
- B-402: Define backup/restore and migration controls.
- B-403: Define build-time security gate checklist.
- B-404: Define final pre-release security audit checklist.
- B-405: Re-open release-gate hardening so `pnpm lint` and `pnpm typecheck` must pass with no exemptions, and add OS rule that READY is blocked when gate runs fail.
- B-406: Define staged rollout flags and activation checks for high-impact V2 capabilities (depreciation rules, scenario override contracts) before production enablement.

## Epic E5: BudgetPage runtime stability and deterministic release gates

- B-501: Fix BudgetPage hook-order crash for `rivit` and `valisummat`-only render paths.
- B-502: Add regression coverage for hard reload and payload-shape switching on BudgetPage.
- B-503: Make root lint deterministic and green across web/api workspace configs.
- B-504: Make root typecheck deterministic and green without suppressions.
- B-505: Enforce `release-check` deterministic order (`lint -> typecheck -> test`) with PASS evidence.

## Epic E6: KVA Excel import customer workflow (`KVA totalt` -> preview -> Talousarvio write)

- B-601: Lock historical-year selection for KVA totals import: use 3 historical years from `KVA totalt`; if style metadata is not reliably detectable, use the earliest 3 year columns in the KVA totals table.
- B-602: Exclude forecast/prognosis years and all `Förändring i...` rows from imported totals.
- B-603: Preserve KVA totals hierarchy in extracted payload (category + subrows + deterministic order) so preview and persistence match.
- B-604: Redesign KVA import modal to show per-year extracted totals before apply ("Your Excel produced these numbers per year").
- B-605: Remove Tuloajurit from KVA import modal and confirm payload; users maintain drivers in Tulot tab.
- B-606: Remove Blad1 account-level rows from KVA import modal flow for now (or keep behind disabled Advanced flag without default persistence).
- B-607: Confirm path must create/update Talousarvio records per imported year deterministically for selected org and budget naming rule.
- B-608: Add fixture-backed parser/mapping regression proof (`fixtures/Simulering av kommande lönsamhet KVA.xlsx`) and keep root gates green.
- B-609: Post-import product decision: merge Tulot and Ennuste UX under a single Ennuste concept.
- B-610: Optional advanced mode decision for Blad1 account-level import rows (default remains removed).
- B-611: Forecast/Ennuste tab: re-enable tuloajurit and computed revenue row when Talousarvio is historical-only (dependency for current Ennuste sprint).
- B-612: Talousarvio 3-year-card UX (import batch, 4 buckets, per-bucket expand, Källa, confirm i18n) — DONE (sprint S-01..S-05).
- B-613: KVA import lockdown — single-source KVA totalt only, preview UI (2 decimals, €, Tulot green/Kulut red), `docs/KVA_IMPORT_LOCKDOWN.md` — DONE (sprint S-01..S-05).
- B-614: Talousarvio tab view — top-of-page message, empty state + manual add line, row labels, TULOS prominence and section styling — DONE (replaced by Ennuste sprint focus).
- B-615: Ennuste page completion per `docs/PROJECTION_UX_PLAN.md` (same-screen per-year / `% from year X` controls, scenario+horizon flow, compute validation, diagram sub-view, regression + root gates) — DONE (sprint S-01..S-05).
- B-616: Ennuste two-zone UX per `docs/SPRINT.md` and `docs/ENNUSTE_IMPLEMENTATION_STEPS.md` — Syötä/Tulokset flow, accordion, single compute, extract components, Suspense, final acceptance (perfectly working site) — in sprint S-01..S-05.

## Epic E7: Forecast and report trust hardening

- B-701: Enforce report create freshness token (`computedFromUpdatedAt`) and reject stale compute/report requests.
- B-702: Ensure report summary KPIs and stored snapshot use canonical shared values (no drift).
- B-703: Make Forecast `Create report` deterministic: explicit compute required, no hidden auto-compute side effects.
- B-704: Improve scenario-switch loading UX so stale values are never shown as current.
- B-705: Add safer investment editor controls (bulk actions + numeric guardrails).
- B-706: Reduce repeated Forecast/Reports GET traffic with bounded cache + force refresh support.

## TBD (Owner: Customer)

- These items are required for final acceptance lock and are non-blocking for DO unless a sprint Stop condition is triggered.
- B-TBD-01: Confirm minimum annual result target for planning acceptance.
- B-TBD-02: Confirm default PDF view preference (combined or split water/wastewater).
- B-TBD-03: Confirm start year for the first mandatory 20-year horizon.
- B-TBD-04: Confirm final business approver for V1 acceptance.
- B-TBD-05: Confirm expected base-fee adjustment cadence.

## Done

- None in this planning cycle yet.
