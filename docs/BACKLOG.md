# Backlog

Structured V1 work pool. `docs/SPRINT.md` is the active execution queue.
Open work stays here. Accepted history lives in `docs/BACKLOG_ARCHIVE.md` so this file remains useful during protocol reads.

## Epic E1: OS hardening and deterministic execution

- B-101: Enforce strict PLAN/DO/RUNSPRINT/REVIEW mode router in `AGENTS.md`.
- B-102: Align canonical precedence and file permissions with AGENTS contract.
- B-104: Enforce concrete sprint evidence format in DO runs (commit hash + file paths + test/artifact output).

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
- B-602: Exclude forecast/prognosis years and all `Forandring i...` rows from imported totals.
- B-603: Preserve KVA totals hierarchy in extracted payload (category + subrows + deterministic order) so preview and persistence match.
- B-604: Redesign KVA import modal to show per-year extracted totals before apply ("Your Excel produced these numbers per year").
- B-605: Remove Tuloajurit from KVA import modal and confirm payload; users maintain drivers in Tulot tab.
- B-606: Remove Blad1 account-level rows from KVA import modal flow for now (or keep behind disabled Advanced flag without default persistence).
- B-607: Confirm path must create/update Talousarvio records per imported year deterministically for selected org and budget naming rule.
- B-608: Add fixture-backed parser/mapping regression proof (`fixtures/Simulering av kommande lonsamhet KVA.xlsx`) and keep root gates green.
- B-609: Post-import product decision: merge Tulot and Ennuste UX under a single Ennuste concept.
- B-610: Optional advanced mode decision for Blad1 account-level import rows (default remains removed).
- B-611: Forecast/Ennuste tab: re-enable tuloajurit and computed revenue row when Talousarvio is historical-only (dependency for current Ennuste sprint).

## Epic E7: Forecast and report trust hardening

- B-701: Enforce report create freshness token (`computedFromUpdatedAt`) and reject stale compute/report requests.
- B-702: Ensure report summary KPIs and stored snapshot use canonical shared values (no drift).
- B-703: Make Forecast `Create report` deterministic: explicit compute required, no hidden auto-compute side effects.
- B-704: Improve scenario-switch loading UX so stale values are never shown as current.
- B-705: Add safer investment editor controls (bulk actions + numeric guardrails).
- B-706: Reduce repeated Forecast/Reports GET traffic with bounded cache + force refresh support.

## Epic E10: Post-refresh trust and accessibility hardening

- B-1009: Add production-facing meta description / low-value SEO cleanup only if it remains user-visible after trust hardening.

## Epic E11: Guided setup wizard and truthful baseline handoff

- B-1109: Preserve detailed year comparison and admin/debug tools behind secondary drill-down surfaces instead of the landing page.
- B-1110: Refresh non-canonical product docs and screenshots after the wizard ships so README/deployment collateral no longer describe the old Overview -> sync entry flow.

## Epic E15: Wizard trust-first lookup, review, and year-detail editing

- B-1501: Replace step-1 explicit-search-only org lookup with assisted lookup, debounced suggestions, and an easier select/connect path.
- B-1502: Harden backend VEETI org search for typeahead so common utility lookups stay reliable despite the current paged alphabetical scan limit.
- B-1503: Separate wizard `technical ready` semantics from human `reviewed/accepted` semantics for imported years, with state that survives reload.
- B-1504: Replace step-2 and step-3 row-count-first year summaries with recognizable business-value previews from the canonical yearly sections.
- B-1505: Make every imported year reviewable and editable from the wizard, not only blocked years.
- B-1506: Replace the blocked-year-only modal with one shared year-detail surface that supports ready, blocked, and excluded years.
- B-1507: Expose raw VEETI versus effective values plus per-section restore paths for financials, prices, and volumes.
- B-1508: Close with a fresh live wizard trust audit that explicitly records whether the whole queue succeeded or stopped on a blocker.

## Epic E16: Wizard review-loop completion and human/power-user layering

- B-1601: Add a true no-change approval path (`Hyvaksy sellaisenaan` / equivalent) that marks a technically ready year as reviewed without forcing edits.
- B-1602: Make reviewed-year progression and summary counts advance immediately after approval/save, including next-year auto-advance where appropriate.
- B-1603: Rewrite ready-year review copy so technically ready years are not framed as problem years.
- B-1604: Remove wizard locale leakage and expand locale-integrity coverage for the year-detail surface and review actions.
- B-1605: Show blocked-year missing values as explicit missing-state UI instead of zero-like placeholders.
- B-1606: Separate review mode from edit mode in the shared year-detail surface so comparison comes first and editing is an explicit choice.
- B-1607: Rebalance the year-detail surface so core review content stays primary while secondary power-user tools remain accessible but less noisy.
- B-1608: Close with a fresh full steps `1..6` live audit from a wiped workspace.

## Epic E17: Wizard year-card accounting model and setup-scope alignment

- B-1701: Replace the current import/review year preview trio (`Liikevaihto`, prices, volumes) with a summary model aligned to the customer's key `Ennuste` rows.
- B-1702: Add a truthful import-year summary contract or mapping so cards can show `Intakter`, `Materialkostnader`, `Personalkostnader`, `Ovriga rorelsekostnader`, and visible `Tulos` without inventing data.
- B-1703: Remove remaining ready/complete semantics from step-2 VEETI cards when they only mean technical importability.
- B-1704: Surface more of the raw accounting shape directly on import cards so users can validate a year before importing, without inferred correctness badges.
- B-1705: Demote low-value technical helper text on import cards unless it is explicitly opened as secondary detail.
- B-1706: Re-audit the full wizard against the original setup-scope lock once the year cards use the customer's accounting model.

## Epic E18: Comprehensive frontend overhaul to the approved canon

- B-1801: Lock one truthful shared shell/status vocabulary across wizard, Forecast, and Reports; no mixed-language scaffolding on primary surfaces.
- B-1802: Expose canonical year trust/source/discrepancy metadata so the wizard can distinguish complete, suspicious, blocked, reviewed, and mixed-source years.
- B-1803: Rebuild step 1 and step 2 into an action-first connect flow plus a trust-first year board with result-to-zero framing.
- B-1804: Make the shared year-review surface start with visible correction choices and full manual override authority.
- B-1805: Make statement-PDF correction a first-class flow with OCR reconciliation, VEETI/PDF/current diffs, and clear confirm / confirm-and-sync actions.
- B-1806: Enforce the planning-baseline gate so Forecast and Reports stay locked until explicit baseline creation.
- B-1807: Rebuild Forecast first load into a CFO-first hero, trust strip, and optional analyst density mode.
- B-1808: Replace the full-horizon first-paint investment dump with progressive disclosure: summary, near-term, grouped long-range, then full table on demand.
- B-1809: Integrate depreciation strategy with the investment workflow in plain finance language with preview and impact kept visible while editing.
- B-1810: Align Forecast comparison, detailed outputs, and Reports to the same provenance/source-mix truth as the wizard and baseline context.
- B-1811: Finish accessibility, responsiveness, contrast, and locale integrity across wizard, Forecast, and Reports.
- B-1812: Re-audit the final frontend end to end, including a real customer statement-PDF correction flow, and require no obvious trust, hierarchy, or workflow gaps in the audited paths.

## Epic E20: Setup year-intake modernization and per-year QDIS import

- B-2008: Re-audit the year-intake flow end to end with the customer's real 2022 QDIS export PDF.

## Epic E21: Historical year repair with user-confirmed Excel selective override

- B-2101: Add a distinct `kva_import` / `excel_import` provenance path instead of storing workbook repairs as generic `manual_edit`.
- B-2102: Parse the six shared financial rows from `KVA totalt` and match them to imported VEETI years deterministically.
- B-2103: Build a year-by-year compare surface that shows VEETI current values, workbook candidate values, and explicit user choices before apply.
- B-2104: Default VEETI-missing cells to workbook values, but require explicit confirmation when workbook values differ from non-missing VEETI values.
- B-2105: Repair Kronoby `2022`, `2023`, and `2024` using workbook-backed selective override, with `Material och tjanster` proven from the customer workbook.
- B-2106: Keep workbook-driven sold-volume override out of the first pass unless a truthful cross-year source is proven from current customer docs.
- B-2107: Add live proof that workbook-confirmed overrides survive reload and keep budget sanity aligned for repaired years.

## Epic E22: Investment plan entry and depreciation defaults at the start of Ennuste

- B-2201: Add an `Investointiohjelma` entry surface at the start of Ennuste before the denser power-user workbenches.
- B-2202: Model investment rows in utility language: year, target, type, group, water EUR, wastewater EUR, total EUR, and note.
- B-2203: Prefill `Poistosaannot` from `Investeringsplan PTS.xlsx` and map them to the current depreciation-rule engine without exposing internal jargon by default.
- B-2204: Use operator-friendly Finnish wording for the investment and depreciation flow, with advanced/internal terms secondary.
- B-2205: Keep depreciation, tariff pressure, and cash impact visible while the investment plan is edited.
- B-2206: Close with a live Kronoby audit that covers wipe, VEETI reconnect/import, workbook repair, 2024 statement merge, and entry into investment planning.

## Epic E28: Security and performance audit remediation

- B-2801: Bound workbook and statement upload surfaces with strict file limits, MIME/extension validation, and a maintained parser path for untrusted files.
- B-2802: Fix auth IP derivation and proxy trust so login/demo/invite throttles cannot be bypassed with spoofed `X-Forwarded-For`.
- B-2803: Replace process-local auth/demo/invite throttles with a shared limiter or an explicitly verified edge-enforced production contract.
- B-2804: Remove browser-shipped `VITE_DEMO_KEY` / `x-demo-key` secrecy assumptions and align docs/env examples with backend-only demo gating.
- B-2805: Reduce per-request auth/legal query cost by removing write-heavy legal document sync from hot request paths and caching current-version lookups safely.
- B-2806: Split OCR/PDF import code out of the default Overview load so heavy assets download only on demand.
- B-2807: Keep charting forecast-scoped and split auth/login CSS from workspace CSS to shrink non-forecast first paint.
- B-2808: Define and verify frontend production security headers at the real delivery edge, with repo-visible docs/config kept in sync.
- B-2809: Add reachable-production dependency/security gate checks, including `pnpm audit --prod` triage and upload-surface regression proof.
- B-2810: Re-run a live security/performance audit after remediation, including build artifact review, header verification, and browser network/console proof.

## TBD (Owner: Customer)

- These items are required for final acceptance lock and are non-blocking for DO unless a sprint Stop condition is triggered.
- B-TBD-01: Confirm minimum annual result target for planning acceptance.
- B-TBD-02: Confirm default PDF view preference (combined or split water/wastewater).
- B-TBD-03: Confirm start year for the first mandatory 20-year horizon.
- B-TBD-04: Confirm final business approver for V1 acceptance.
- B-TBD-05: Confirm expected base-fee adjustment cadence.
