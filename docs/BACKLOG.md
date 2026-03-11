# Backlog

Structured V1 work pool. `docs/SPRINT.md` is the active execution queue.

## Epic E1: OS hardening and deterministic execution

- B-101: Enforce strict PLAN/DO/RUNSPRINT/REVIEW mode router in `AGENTS.md`.
- B-102: Align canonical precedence and file permissions with AGENTS contract.
- B-103: Keep sprint schema executable with a variable-length active queue: Do/Files/Acceptance/Evidence/Stop/Status. -- DONE (implemented in `AGENTS.md`, `docs/CANONICAL.md`, and `docs/SPRINT.md`)
- B-104: Enforce concrete sprint evidence format in DO runs (commit hash + file paths + test/artifact output).
- B-105: Allow continuous DO->REVIEW execution loops until the whole sprint list is DONE, without requiring extra user prompts between runs. -- DONE (implemented in `AGENTS.md`)
- B-106: Add `RUNSPRINT` as an explicit whole-sprint execution entry while keeping `DO` valid. -- DONE (implemented in `AGENTS.md`)
- B-107: Clarify clean-tree semantics so ignored local files do not block protocol runs, while tracked/unignored dirt still does. -- DONE (implemented in `AGENTS.md`)
- B-108: Allow DO to edit sprint-scoped non-canonical repo docs/config examples while keeping canonical planning docs protected. -- DONE (implemented in `AGENTS.md`)

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
- B-612: Talousarvio 3-year-card UX (import batch, 4 buckets, per-bucket expand, Källa, confirm i18n) -- DONE (sprint S-01..S-05)
- B-613: KVA import lockdown -- single-source KVA totalt only, preview UI (2 decimals, EUR, Tulot green/Kulut red), `docs/KVA_IMPORT_LOCKDOWN.md` -- DONE (sprint S-01..S-05)
- B-614: Talousarvio tab view -- top-of-page message, empty state + manual add line, row labels, TULOS prominence and section styling -- DONE (replaced by Ennuste sprint focus)
- B-615: Ennuste page completion per `docs/PROJECTION_UX_PLAN.md` (same-screen per-year / `% from year X` controls, scenario+horizon flow, compute validation, diagram sub-view, regression + root gates) -- DONE (sprint S-01..S-05)
- B-616: Ennuste two-zone UX per `docs/SPRINT.md` and `docs/ENNUSTE_IMPLEMENTATION_STEPS.md` -- Syötä/Tulokset flow, accordion, single compute, extract components, Suspense, final acceptance -- DONE

## Epic E7: Forecast and report trust hardening

- B-701: Enforce report create freshness token (`computedFromUpdatedAt`) and reject stale compute/report requests.
- B-702: Ensure report summary KPIs and stored snapshot use canonical shared values (no drift).
- B-703: Make Forecast `Create report` deterministic: explicit compute required, no hidden auto-compute side effects.
- B-704: Improve scenario-switch loading UX so stale values are never shown as current.
- B-705: Add safer investment editor controls (bulk actions + numeric guardrails).
- B-706: Reduce repeated Forecast/Reports GET traffic with bounded cache + force refresh support.

## Epic E8: Bokslut PDF extraction runtime decision

- B-801: Choose and implement a locally runnable result-statement extraction path for bookkeeping PDFs (OCR-capable or otherwise) before continuing S-21 parser work; current customer PDF pages return empty text via `pypdf`. -- DONE

## Epic E9: Statement import productization

- B-901: Make bokslut import a first-class Overview year action in `apps/web/src/v2/OverviewPageV2.tsx` instead of hiding it behind generic manual completion. -- DONE
- B-902: Add a dedicated review-and-confirm UX in `apps/web/src/v2/OverviewPageV2.tsx` and `apps/web/src/v2/v2.css` that states exactly which datasets will change and which stay on VEETI/manual sources. -- DONE
- B-903: Persist richer statement-import provenance in `apps/api/src/v2/v2.service.ts` and `apps/web/src/api.ts` so reports can distinguish OCR-backed financial overrides from generic manual edits. -- DONE
- B-904: Bundle OCR runtime assets locally in `apps/web/package.json`, Vite config, and `apps/web/src/v2/statementOcr.ts` so statement import does not depend on jsDelivr at runtime. -- DONE
- B-905: Add fixture-backed OCR/parser regression coverage in `apps/web/src/v2/statementOcr.test.ts` for at least 2-3 real bokslut export layouts. -- DONE
- B-906: Push effective statement-import financials explicitly through Forecast and Reports in `apps/api/src/v2/v2.service.ts`, `apps/web/src/v2/OverviewPageV2.tsx`, and the V2 Forecast/Reports pages so users see the same trusted baseline everywhere. -- DONE

## Epic E10: Post-refresh trust and accessibility hardening

- B-1001: Require visible destructive confirmation UX and backend token enforcement for account/org clear actions. -- DONE (sprint S-31)
- B-1002: Remove legacy asset-management copy from login and first-run UI. -- DONE (sprint S-32)
- B-1003: Align demo/dev runtime truth across backend status, login affordances, env examples, and docs. -- DONE (sprint S-32)
- B-1004: Define one explicit Forecast freshness/status model for unsaved, stale, computing, and current-computed states. -- DONE (sprint S-33)
- B-1005: Separate Forecast draft/input state from compute-backed output authority so save-only cannot look computed. -- DONE (sprint S-34)
- B-1006: Remove mixed-language leakage across login, Overview, Forecast, and Reports. -- DONE (sprint S-35)
- B-1007: Restore trustworthy back/forward state and report-readiness derivation between Forecast and Reports. -- DONE (sprint S-34)
- B-1008: Fix desktop accessible-name and field-label gaps in the refreshed V2 flow. -- DONE (sprint S-36)
- B-1009: Add production-facing meta description / low-value SEO cleanup only if it remains user-visible after trust hardening. -- backlog only

## Epic E11: Guided setup wizard and truthful baseline handoff

- B-1101: Replace the first authenticated V2 window with a six-step guided setup wizard rooted in current Overview data/actions. -- in sprint (`S-37`)
- B-1102: Show persistent setup progress summary and connected org chip as imported company name + short workspace hash. -- in sprint (`S-37`)
- B-1103: Separate utility connection, year import, and planning-baseline creation into truthful distinct steps instead of the current `syncImport` coupling. -- in sprint (`S-38`, `S-41`)
- B-1104: Reduce year review to three checks (`Tilinpäätös`, `Taksa`, `Volyymit`) plus one overall year status. -- in sprint (`S-39`)
- B-1105: Replace setup-surface delete wording with truthful `Pois suunnitelmasta` exclusion/restore behavior, separating planning exclusion from destructive year deletion. -- in sprint (`S-40`)
- B-1106: Replace setup-surface `sync` / `sync ready` / `baseline budget` jargon with planning language users understand (`Tuo valitut vuodet`, `Luo suunnittelupohja`). -- in sprint (`S-38`, `S-41`)
- B-1107: Keep Ennuste visibly locked until the wizard is complete, then hand off into scenario naming + horizon setup. -- in sprint (`S-42`)
- B-1108: Remove or demote peer snapshot, ops snapshot, duplicate status blocks, and equal-weight dashboard cards from the setup window. -- in sprint (`S-37`, `S-39`)
- B-1109: Preserve detailed year comparison and admin/debug tools behind secondary drill-down surfaces instead of the landing page. -- backlog after sprint acceptance
- B-1110: Refresh non-canonical product docs and screenshots after the wizard ships so README/deployment collateral no longer describe the old Overview -> sync entry flow. -- backlog after sprint acceptance

## TBD (Owner: Customer)

- These items are required for final acceptance lock and are non-blocking for DO unless a sprint Stop condition is triggered.
- B-TBD-01: Confirm minimum annual result target for planning acceptance.
- B-TBD-02: Confirm default PDF view preference (combined or split water/wastewater).
- B-TBD-03: Confirm start year for the first mandatory 20-year horizon.
- B-TBD-04: Confirm final business approver for V1 acceptance.
- B-TBD-05: Confirm expected base-fee adjustment cadence.

## Done

- B-801: OCR-capable statement extraction path was chosen and implemented in the browser with bundled local Tesseract assets.
- B-901: Bokslut import is a first-class Overview year action.
- B-902: Review-and-confirm import UX states which datasets change and which stay on VEETI/manual sources.
- B-903: Statement-import provenance is persisted distinctly from generic manual edits.
- B-904: OCR runtime assets are bundled locally.
- B-905: OCR/parser regression coverage exists for the shipped bokslut import path.
- B-906: Effective statement-import financials flow through Forecast and Reports.
