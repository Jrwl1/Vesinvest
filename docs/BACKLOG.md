# Backlog

Structured V1 work pool. `docs/SPRINT.md` is the active execution queue.

## Epic E1: OS hardening and deterministic execution

- B-101: Enforce strict PLAN/DO/RUNSPRINT/REVIEW mode router in `AGENTS.md`.
- B-102: Align canonical precedence and file permissions with AGENTS contract.
- B-103: Keep sprint schema executable with a variable-length active queue: Do/Files/Acceptance/Evidence/Stop/Status. -- DONE (implemented in `AGENTS.md`, `docs/CANONICAL.md`, and `docs/SPRINT.md`)
- B-104: Enforce concrete sprint evidence format in DO runs (commit hash + file paths + test/artifact output).
- B-105: Allow continuous DO->REVIEW execution loops until the whole active sprint list is DONE, without requiring extra user prompts between runs. -- DONE (implemented in `AGENTS.md`)
- B-106: Add `RUNSPRINT` as an explicit whole-sprint execution entry while keeping `DO` valid. -- DONE (implemented in `AGENTS.md`)
- B-107: Clarify clean-tree semantics so ignored local files do not block protocol runs, while tracked/unignored dirt still does. -- DONE (implemented in `AGENTS.md`)
- B-108: Allow DO to edit sprint-scoped non-canonical repo docs/config examples while keeping canonical planning docs protected. -- DONE (implemented in `AGENTS.md`)
- B-109: Allow PLAN to use bounded read-only research helpers while keeping the parent's required canonical reads non-delegable. -- DONE (implemented in `AGENTS.md`)
- B-110: Allow DO/RUNSPRINT to use bounded native helper agents for the currently selected substep while keeping scope, commits, evidence, and clean-tree checks parent-owned. -- DONE (implemented in `AGENTS.md`)
- B-111: Make `AGENTS.md` authoritative for protocol-required read order and helper limits, with `docs/CANONICAL.md` mirroring that contract. -- DONE (implemented in `AGENTS.md` and `docs/CANONICAL.md`)
- B-112: Allow DO to absorb pre-existing dirty paths only when they are already inside the selected substep scope and can be safely explained as part of that substep, while keeping end-of-run clean-tree enforcement. -- DONE (implemented in `AGENTS.md`)
- B-113: Add a bounded same-package gate-fix path for required DO/RUNSPRINT verification failures so avoidable same-package fallout does not force an immediate stop. -- DONE (implemented in `AGENTS.md` and `docs/SPRINT.md`)
- B-114: Require sprint authors to include likely same-package implementation/consumer files whenever a substep tightens a new test, parity, lint, typecheck, schema, or contract gate. -- DONE (implemented in `AGENTS.md` and `docs/SPRINT.md`)
- B-115: Require a pre-product-commit hygiene check that classifies dirty paths before staging and blocks scope mismatch early. -- DONE (implemented in `AGENTS.md`)
- B-116: Distinguish `HARD BLOCKED` from `GATE BLOCKED` in DO evidence and stop handling. -- DONE (implemented in `AGENTS.md` and `docs/SPRINT.md`)
- B-117: Add a session-scoped read-only `HUMANAUDIT` intake lane with `OK GO` freeze semantics and later-`PLAN` sprint materialization. -- DONE (implemented in `AGENTS.md` and canonical planning docs)

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
- B-612: Talousarvio 3-year-card UX (import batch, 4 buckets, per-bucket expand, Kalla, confirm i18n) -- DONE (sprint S-01..S-05)
- B-613: KVA import lockdown -- single-source KVA totalt only, preview UI (2 decimals, EUR, Tulot green/Kulut red), `docs/KVA_IMPORT_LOCKDOWN.md` -- DONE (sprint S-01..S-05)
- B-614: Talousarvio tab view -- top-of-page message, empty state + manual add line, row labels, TULOS prominence and section styling -- DONE (replaced by Ennuste sprint focus)
- B-615: Ennuste page completion per `docs/PROJECTION_UX_PLAN.md` (same-screen per-year / `% from year X` controls, scenario+horizon flow, compute validation, diagram sub-view, regression + root gates) -- DONE (sprint S-01..S-05)
- B-616: Ennuste two-zone UX per `docs/SPRINT.md` and `docs/ENNUSTE_IMPLEMENTATION_STEPS.md` -- Syota/Tulokset flow, accordion, single compute, extract components, Suspense, final acceptance -- DONE

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

- B-1101: Replace the first authenticated V2 window with a six-step guided setup wizard rooted in current Overview data/actions. -- DONE (initial rollout in `S-37..S-42`; corrective gaps are tracked in E12)
- B-1102: Show persistent setup progress summary and connected org chip as imported company name + short workspace hash. -- DONE (initial rollout in `S-37..S-42`; corrective gaps are tracked in E12)
- B-1103: Separate utility connection, year import, and planning-baseline creation into truthful distinct steps instead of the current `syncImport` coupling. -- DONE (initial rollout in `S-37..S-42`; corrective gaps are tracked in E12)
- B-1104: Reduce year review to three checks (`Tilinpaatos`, `Taksa`, `Volyymit`) plus one overall year status. -- DONE (initial rollout in `S-37..S-42`; corrective gaps are tracked in E12)
- B-1105: Replace setup-surface delete wording with truthful `Pois suunnitelmasta` exclusion/restore behavior, separating planning exclusion from destructive year deletion. -- DONE (initial rollout in `S-37..S-42`; corrective gaps are tracked in E12)
- B-1106: Replace setup-surface `sync` / `sync ready` / `baseline budget` jargon with planning language users understand (`Tuo valitut vuodet`, `Luo suunnittelupohja`). -- DONE (initial rollout in `S-37..S-42`; corrective gaps are tracked in E12)
- B-1107: Keep Ennuste visibly locked until the wizard is complete, then hand off into scenario naming + horizon setup. -- DONE (initial rollout in `S-37..S-42`; corrective gaps are tracked in E12)
- B-1108: Remove or demote peer snapshot, ops snapshot, duplicate status blocks, and equal-weight dashboard cards from the setup window. -- DONE (initial rollout in `S-37..S-42`; corrective gaps are tracked in E12)
- B-1109: Preserve detailed year comparison and admin/debug tools behind secondary drill-down surfaces instead of the landing page. -- backlog after sprint acceptance
- B-1110: Refresh non-canonical product docs and screenshots after the wizard ships so README/deployment collateral no longer describe the old Overview -> sync entry flow. -- backlog after sprint acceptance
- B-1111: Remove extra primary CTAs from the legacy import panels so only the active wizard step owns the loud action state on the first window. -- DONE (initial rollout in `S-37..S-42`; corrective gaps are tracked in E12)

## Epic E12: Wizard corrective refactor and locale parity

- B-1201: Split available VEETI years from explicit workspace-imported years, persist the step-2 selection, and clean downstream backend consumers that still reuse raw available years. -- DONE (sprint `S-43`)
- B-1202: Retire or redefine legacy sync semantics (`veeti-sync` connect behavior, `/import/sync`, empty-input baseline fallback, and reset semantics) so connect no longer behaves like import. -- DONE (sprint `S-43`)
- B-1203: Introduce one authoritative active-step contract, including selected problem-year state, explicit `review continue` transitions, and shell/body alignment. -- DONE (sprint `S-44`)
- B-1204: Remove the stacked legacy setup surfaces and enforce one primary CTA per active step. -- DONE (sprint `S-45`)
- B-1205: Fix wizard translation-key mismatches, add missing locale entries across all wizard chrome, and hard-fail parity tests on wizard key drift. -- DONE (sprint `S-46`)
- B-1206: End the corrective sprint with a fresh Finnish Kronoby UI/UX re-audit that explicitly records whether the whole sprint succeeded or stopped on a blocker. -- DONE (sprint `S-47`)

## Epic E13: Wizard UX coherence and handoff polish

- B-1301: Make the active wizard step surface the first visible actionable content on step 1 and step 2 instead of placing non-actionable hero/summary chrome above it. -- DONE (sprint `S-50`)
- B-1302: Make shell connection state, page indicator, org chip, and locked tabs derive from setup truth on direct routes and after clear/reset instead of from token-only identity or Overview-only callbacks. -- DONE (sprint `S-48`)
- B-1303: Keep human-facing year semantics explicit and imported-only: available VEETI years, imported workspace years, ready imported years, blocked imported years, and excluded years must not be blended in summaries or progression logic. -- DONE (sprint `S-49`)
- B-1304: Split step-2 importable years from repair-only years so the main import list and its explanatory copy describe the same set of years. -- DONE (sprint `S-50`)
- B-1305: Demote duplicate summary/hero surfaces into compact supporting context so the active step owns the narrative and primary action. -- DONE (sprint `S-50`)
- B-1306: Smooth the step-6 handoff so Forecast and Reports feel like a continuation of setup rather than a second onboarding phase, then close with a fresh UX consistency audit. -- DONE (sprint `S-51`, `S-52`)

## Epic E14: Power-user Forecast cockpit and scenario-specific depreciation

- B-1401: Replace the current long form-first Forecast landing with a resultatrakning-first cockpit centered on `Intakter`, `Materialkostnader`, `Personalkostnader`, `Ovriga rorelsekostnader`, and `Avskrivningar`. -- DONE (sprint `S-54`)
- B-1402: Introduce one explicit Forecast status/command strip so scenario freshness, compute state, and report readiness never contradict each other. -- DONE (sprint `S-53`)
- B-1403: Add statement-native drill-down editing for the four non-depreciation pillars so power users can edit drivers without losing the result statement context. -- DONE (sprint `S-55`)
- B-1404: Add a denser analyst-oriented Forecast presentation with better scanability, less narrative chrome, and faster yearly editing. -- DONE (sprint `S-55`)
- B-1405: Migrate depreciation rules from organization-level storage to scenario-specific storage so each scenario can own its own `Avskrivningar` setup. -- DONE (sprint `S-56`)
- B-1405a: Expand the `S-56` implementation scope to include the V2 controller route layer and projection compute seam so scenario-scoped depreciation CRUD can be exposed compatibly without relying on the old org-global endpoints. -- DONE (resolved inside sprint `S-56`)
- B-1406: Model `Avskrivningar` as two explicit layers: `Basavskrivningar` from the company base situation and `Nya investeringars avskrivningar` from scenario investments. -- DONE (sprint `S-56`)
- B-1407: Support `straight-line` and `custom annual schedule` depreciation methods, with exactly one depreciation category per investment in the first implementation pass. -- DONE (backend contract in sprint `S-56`; UI mapping lands in `S-57`)
- B-1408: Add one-to-one investment mapping, unmapped-state visibility, and yearly depreciation preview before report creation. -- DONE (sprint `S-57`)
- B-1409: Add statement-native scenario comparison and power-user audit proof for the new cockpit. -- DONE (sprint `S-58`)

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

- B-1701: Replace the current import/review year preview trio (`Liikevaihto`, prices, volumes) with a summary model aligned to the customer’s key `Ennuste` rows.
- B-1702: Add a truthful import-year summary contract or mapping so cards can show `Intakter`, `Materialkostnader`, `Personalkostnader`, `Ovriga rorelsekostnader`, and visible `Tulos` without inventing data.
- B-1703: Remove remaining “ready/complete” semantics from step-2 VEETI cards when they only mean technical importability.
- B-1704: Surface more of the raw accounting shape directly on import cards so users can validate a year before importing, without inferred correctness badges.
- B-1705: Demote low-value technical helper text on import cards unless it is explicitly opened as secondary detail.
- B-1706: Re-audit the full wizard against the original setup-scope lock once the year cards use the customer’s accounting model.

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

## Epic E19: Yhteenveto year-card perfection sprint

- B-1901: Use direct VEETI `AineetJaPalvelut` when present and remove the fallback split from `LiiketoiminnanMuutKulut`. -- DONE (sprint `S-87..S-92`)
- B-1902: Add `Poistot` to the card contract so the 5 canon line items plus `Tulos` are always visible on step-2/step-3 year cards. -- DONE (sprint `S-87..S-92`)
- B-1903: Distinguish real `0` from missing VEETI values in both copy and visual treatment. -- DONE (sprint `S-87..S-92`)
- B-1904: Replace vague trust copy with literal source/problem wording on the cards. -- DONE (sprint `S-87..S-92`)
- B-1905: Make the card itself the normal editing surface with inline whole-card edit mode. -- DONE (sprint `S-87..S-92`)
- B-1906: Keep secondary main stats on the card: water price, wastewater price, sold water volume, and sold wastewater volume. -- DONE (sprint `S-87..S-92`)
- B-1907: Keep save, save-and-sync, restore VEETI, statement-PDF import, and exclude actions owned by the card. -- DONE (sprint `S-87..S-92`)
- B-1908: Reuse the same card model in step 3 review so the user does not learn a second year surface. -- DONE (sprint `S-87..S-92`)
- B-1909: Only expose subrow expansion if real source data exists; do not fake subrows from summary rows. -- DONE (sprint `S-87..S-92`)
- B-1910: Keep all card language tied to the chosen UI language and only auto-select org language if the current VEETI org payload actually provides one. -- DONE (sprint `S-87..S-92`)
- B-1911: Re-audit `Yhteenveto` end to end, including the real 2024 statement-PDF correction path and an explicit answer on subrow availability. -- DONE (sprint `S-87..S-92`)
- B-1912: Expand the manual year patch contract to include direct `AineetJaPalvelut` editing so `S-89..S-90` can truthfully support click-to-edit on every visible canon row. -- DONE

## Epic E20: Setup year-intake modernization and per-year QDIS import

- B-2001: Make step 2 action-first and remove dead hero/helper chrome so year selection is the first visible task. -- DONE (sprint `S-93`)
- B-2002: Replace verbose/dramatic year-intake copy with short literal selection/review wording. -- DONE (sprint `S-93`)
- B-2003: Rebuild the ready/suspicious/blocked board into a compact high-trust layout with calmer warning treatment. -- DONE (sprint `S-94`)
- B-2004: Collapse blocked years by default and replace repeated missing-state boxes with quantified missing-data summaries. -- DONE (sprint `S-94`)
- B-2005: Add direct per-year repair affordances for missing prices and volumes and focus the missing field when repair starts. -- DONE (sprint `S-95`)
- B-2006: Add a per-year QDIS PDF import flow that tries direct PDF extraction first and OCR fallback second. -- DONE (sprint `S-96`)
- B-2007: Layer QDIS-imported values above VEETI truthfully and expose explicit wizard-year provenance for VEETI, manual edits, bokslut PDF, and QDIS PDF. -- DONE (sprint `S-97`)
- B-2008: Re-audit the year-intake flow end to end with the customer's real 2022 QDIS export PDF.

## Epic E21: Historical year repair with user-confirmed Excel selective override

- B-2101: Add a distinct `kva_import` / `excel_import` provenance path instead of storing workbook repairs as generic `manual_edit`.
- B-2102: Parse the six shared financial rows from `KVA totalt` and match them to imported VEETI years deterministically.
- B-2103: Build a year-by-year compare surface that shows VEETI current values, workbook candidate values, and explicit user choices before apply.
- B-2104: Default VEETI-missing cells to workbook values, but require explicit confirmation when workbook values differ from non-missing VEETI values.
- B-2105: Repair Kronoby `2022`, `2023`, and `2024` using workbook-backed selective override, with `Material och tjanster` proven from the customer workbook.
- B-2106: Keep workbook-driven sold-volume override out of the first pass unless a truthful cross-year source is proven from current customer docs.
- B-2107: Add live proof that workbook-confirmed overrides survive reload and keep budget sanity aligned for repaired years.
- B-2108: Add a per-field same-year provenance model for `2024` so statement-PDF-backed finance values and workbook-backed line repairs can coexist without collapsing to one dataset-level source label. -- DONE (sprint `S-102`)

## Epic E22: Investment plan entry and depreciation defaults at the start of Ennuste

- B-2201: Add an `Investointiohjelma` entry surface at the start of Ennuste before the denser power-user workbenches.
- B-2202: Model investment rows in utility language: year, target, type, group, water EUR, wastewater EUR, total EUR, and note.
- B-2203: Prefill `Poistosaannot` from `Investeringsplan PTS.xlsx` and map them to the current depreciation-rule engine without exposing internal jargon by default.
- B-2204: Use operator-friendly Finnish wording for the investment and depreciation flow, with advanced/internal terms secondary.
- B-2205: Keep depreciation, tariff pressure, and cash impact visible while the investment plan is edited.
- B-2206: Close with a live Kronoby audit that covers wipe, VEETI reconnect/import, workbook repair, 2024 statement merge, and entry into investment planning.
- B-2207: Preserve explicit 2024 statement-PDF + workbook mixed ownership through the wizard review, baseline creation, and Forecast handoff. -- DONE (resolved in sprint `S-106` with the same-year statement import review-flow fix)

## Epic E23: CFO end-to-end trust and depreciation UX hardening

- B-2301: Require explicit no-change approval for technically ready years before they count as reviewed or baseline-eligible. -- DONE (sprint `S-113..S-120`)
- B-2302: Treat missing canon finance rows on wizard year cards as `needs attention`, even when higher-level VEETI dataset presence would otherwise look technically ready. -- DONE (sprint `S-113..S-120`)
- B-2303: Remove mixed-language fallback and stale helper copy from wizard, Forecast, and Reports primary surfaces. -- DONE (sprint `S-113..S-120`)
- B-2304: Smooth the step-6 handoff into Ennuste so first scenario creation feels like a continuation of setup instead of an empty-shelf detour. -- DONE (sprint `S-113..S-120`)
- B-2305: Add CFO-facing default depreciation assistance for future investments, including explicit default/carry-forward mapping shortcuts while keeping ambiguous years manual. -- DONE (sprint `S-113..S-120`)
- B-2306: Keep the `Poistosaannot` workbench plain-language and stateful so users can see rule impact, mapping completeness, and report readiness without reading internal jargon. -- DONE (sprint `S-113..S-120`)
- B-2307: Remove misleading report-page empty-state copy when reports already exist and align report headers with current state. -- DONE (sprint `S-113..S-120`)
- B-2308: Fix Forecast form accessibility issues, including the live duplicate-form-field warning surfaced in browser audit. -- DONE (sprint `S-113..S-120`)
- B-2309: Re-audit the full reset -> connect -> import -> review -> baseline -> forecast -> report path and require a CFO-usable outcome with no obvious trust or hierarchy blocker. -- DONE (sprint `S-113..S-120`)

## Epic E24: Unified visual system overhaul grounded in current V2 workflow truth

- B-2401: Reset shared visual tokens, typography, and shell hierarchy across login, Overview, Forecast, and Reports. -- DONE (sprint `S-121..S-127`)
- B-2402: Redesign login and other entry states into a trust-first workspace entry without changing auth behavior. -- DONE (sprint `S-121..S-127`)
- B-2403: Redesign Overview pending-review states into an action-first review desk with stronger workspace truth and explicit approval/provenance visibility. -- DONE (sprint `S-121..S-127`)
- B-2404: Add a strong baseline-ready / accepted-years Overview state so the first tab remains useful after setup completion. -- DONE (sprint `S-121..S-127`)
- B-2405: Rebuild Forecast into a chart-first cockpit while preserving compute freshness, depreciation visibility, investment-program entry, and report-readiness truth. -- DONE (sprint `S-121..S-127`)
- B-2406: Rebuild Reports into a ledger + document-preview surface while preserving snapshot provenance, variant choice, and export/readiness truth. -- DONE (sprint `S-121..S-127`)
- B-2407: Finish responsiveness, accessibility, and locale consistency across the redesigned surfaces and close with a new live end-to-end UI audit. -- DONE (sprint `S-121..S-127`)

## Epic E25: Post-audit wizard interaction, trust, and performance hardening

- B-2501: Make the login window feel distinctly Vesipolku and demote API/demo environment chrome to low-priority metadata. -- DONE (sprint `S-128..S-136`)
- B-2502: Add explicit wizard back-step navigation and remove duplicate step wording so the active task owns the page. -- DONE (sprint `S-128..S-136`)
- B-2503: Speed up step-1 lookup/connect with direct numeric or ID lookup and a lighter post-connect handoff. -- DONE (sprint `S-128..S-136`)
- B-2504: Separate step-2 selectable, suspicious, blocked, and parked year states instead of overloading one selection model. -- DONE (sprint `S-128..S-136`)
- B-2505: Treat visible missing main-row values as warnings and keep main-card missing finance rows out of the normal selectable lane by default. -- DONE (sprint `S-128..S-136`)
- B-2506: Replace step-2 detached under-card editors with in-place row editing, Enter-save, Escape-cancel, and non-destructive outside-click behavior. -- DONE IN PART (sprint `S-128..S-136`; residual row-local gap stays open in `E26`)
- B-2507: Reuse the same in-place editing model in step 3 and replace abstract OK chips with concrete bokslut/price/volume value summaries. -- DONE IN PART (sprint `S-128..S-136`; residual card-native review gap stays open in `E26`)
- B-2508: Reduce first-open and Overview load cost by cutting non-essential blocking fetches and eager year-detail prefetch. -- DONE IN PART (sprint `S-128..S-136`; residual linked-workspace prefetch gap stays open in `E26`)
- B-2509: Close literal copy, locale parity, accessibility, and responsive polish across the new login and wizard interaction model. -- DONE (sprint `S-128..S-136`)
- B-2510: Re-audit the full login -> step 6 -> Forecast/Reports handoff after the interaction/performance queue lands. -- DONE (sprint `S-128..S-136`)

## Epic E26: Residual year-card interaction-truth cleanup

- B-2601: Make year correction truly row-local in step 2 instead of expanding a whole-card all-fields editor under the card. -- DONE (sprint `S-137`)
- B-2602: Keep step-3 review and correction card-native instead of opening a secondary under-card review slab. -- DONE (sprint `S-138`)
- B-2603: Make row save feel local: preserve the current step/card context and avoid unnecessary full-step reload after `manual-year` save. -- DONE (sprint `S-139`)
- B-2604: Bound linked-workspace year-detail prefetch to the visible/imported years for the active step instead of fetching non-visible future years on Overview load. -- DONE (sprint `S-140`)
- B-2605: Demote login environment metadata further so the sign-in task remains visually primary. -- DONE (sprint `S-141`)
- B-2606: Re-audit the linked-workspace login -> step 3 -> save/edit path after the cleanup lands. -- DONE (sprint `S-141`)

## Epic E27: OverviewPageV2 decomposition and behavior-preserving extraction

- B-2701: Extract pure selectors, comparison builders, label helpers, and prefetch-year logic out of `apps/web/src/v2/OverviewPageV2.tsx` into dedicated V2 helper modules.
- B-2702: Extract overview/search/connect/import orchestration and setup-state derivation into dedicated hooks while preserving current API calls and route behavior.
- B-2703: Extract manual year patch, inline edit state, and statement/workbook/QDIS workflow coordination into dedicated hooks/modules without changing current backend contracts.
- B-2704: Split step 1, step 2, step 3, baseline, and handoff rendering into dedicated components and shared year-card/action-cluster pieces.
- B-2705: Reduce `apps/web/src/v2/OverviewPageV2.tsx` from a monolith to a route-level orchestration shell with a materially smaller line count and narrower blast radius.
- B-2706: Re-run focused setup regressions plus a linked-workspace live audit after the refactor to prove no behavior drift in the accepted setup flow.

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

## Epic E29: HUMANAUDIT-derived wizard trust and interaction repair

- B-2901: Replace login step-jargon with plain product/task language and remove repeated sign-in chrome.
- B-2902: Demote or hide API/demo environment diagnostics on normal login paths while keeping explicit demo availability truth.
- B-2903: Stop VEETI connect-step auto-search from retriggering after typing/selection settles.
- B-2904: Keep connected-state setup context in one persistent support rail after VEETI link instead of duplicate bottom summary cards.
- B-2905: Render step-2 year cards chronologically within each lane and keep the board readable when five or more good years are available.
- B-2906: Collapse parked/unselected years into a secondary disclosure instead of a full primary lane.
- B-2907: Replace `Sekundära huvudtal` and similar internal labels with plain business language and quieter secondary treatment.
- B-2908: Make the full step-2 finance row clickable for inline edit and close the editor on save.
- B-2909: Remove the post-save stuck-state/tiny-target recovery path between year cards.
- B-2910: Make the result warning/signal understandable and coherent after inline financial edits, including removing `/ 0` jargon.
- B-2911: Re-audit the connected wizard path after fixes, including a five-year import case and row-edit/save behavior across multiple cards.
- B-2912: Force unauthenticated app entry to Finnish by default until the user explicitly chooses another language. -- DONE (sprint `S-163`)
- B-2913: Add the existing in-app language selector to the login screen and rewrite FI/SV/EN login copy from one plain Finnish source text instead of workflow-jargon variants. -- DONE (sprint `S-163`)
- B-2914: Replace the login pill/hero duplication with one calmer Vesipolku wordmark treatment and literal left-rail value copy.
- B-2915: Make the visible step-2/step-3 year-card `Tulos` follow visible finance-row edits instead of a stale separate-field value.
- B-2916: Remove low-value year-card result commentary and shorten any remaining trust wording to literal status language only.
- B-2917: Fix compact year-card secondary-stat tiles so Finnish labels such as `Jäteveden hinta` fit cleanly without ugly overflow.
- B-2918: Re-audit login and year-card result editing with a real expense-edit case and record whether the queue fully succeeds.

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
