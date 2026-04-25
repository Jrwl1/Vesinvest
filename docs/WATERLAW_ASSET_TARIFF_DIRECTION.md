# Water Law Direction: Asset Management, Tariffs, and Reports

Date: 2026-04-25

## Purpose

This document records the product direction after reviewing the 2026 Finnish water-law webinar material provided in:

- `C:\Users\john\Downloads\Omaisuudenhallintasuunnitelma_ja_maksut_elinvoimakeskus_webinaari17042026.pdf`
- `C:\Users\john\Downloads\Omaisuudenhallintaa_Raision_Vesi_Oyssä.pdf`
- `C:\Users\john\Downloads\ohje omaisuudenhallintasuunnitelma webinaari17042026_Vesilaitosyhdistys.pdf`
- `C:\Users\john\Downloads\Omaisuudenhallinta ja maksut_esitys_KyVe_valmis.pdf`

Working assumption: the interpretation summarized to the customer insider is correct. The app should continue toward the workflow:

`trusted baseline -> asset-management plan -> forecast -> tariff plan -> reports`

The change is that Asset Management must become a broader evidence, governance, and public-document readiness environment, and Tariff Plan must become a revenue/cost/assumption evidence environment, not only a price recommendation page.

## Direction Changes

### 1. Asset Management Is More Than Investment Rows

The law-facing asset-management plan must cover more than the current investment/depreciation model. It should cover:

- Water and wastewater networks, plants, pumping stations, wells, equipment, and other core water-service assets.
- Other key assets such as buildings, sludge handling, IT systems, OT/control systems, billing systems, payroll/customer systems, and other systems that affect continuity.
- Asset age, material, condition information, and the basis of any condition estimate.
- Missing asset information and a plan for completing it.
- Condition-study methods and recurrence.
- Maintenance and service-document summaries and how execution is tracked.
- Renovation debt, maintenance debt, and knowledge debt as explicit evidence/risk concepts.

Current code has a good first investment-program base:

- `apps/web/src/v2/AssetManagementPageV2.tsx`
- `apps/web/src/v2/VesinvestPlanningPanel.tsx`
- `apps/web/src/v2/vesinvestPlanningInvestmentWorkspace.tsx`
- `apps/web/src/v2/useVesinvestPlanningController.ts`
- `apps/api/prisma/schema.prisma` models `VesinvestPlan`, `VesinvestProject`, and `VesinvestProjectAllocation`
- `apps/api/src/v2/v2-vesinvest.service.ts`

But the current model is primarily project/allocation/depreciation oriented. It lacks first-class evidence for asset inventory, data completeness, condition-study practice, maintenance practice, public/confidential publication boundaries, municipal-plan dependencies, and execution capacity.

### 2. Plan Lifecycle Must Be First-Class

The asset-management plan must be kept current and reviewed/updated at least every three years. Some areas, especially fees, should be reviewed annually in connection with fee revisions.

Current code already has:

- `VesinvestPlan.lastReviewedAt`
- `VesinvestPlan.reviewDueAt`
- status fields in `V2VesinvestPlanSummary`
- review due display in `VesinvestRevisionSummary`

Direction:

- Keep the three-year review due date.
- Add annual tariff-review state.
- Show whether the next required review is asset-plan review, annual tariff review, or both.
- Reports should snapshot the review dates and whether the plan was current at the time of report creation.

### 3. Public Plan vs Confidential Appendix

The asset-management plan is generally a public document, but sensitive/security material can be separated into confidential appendices.

Direction:

- Reports should support at least two export/readiness modes:
  - Public asset-management/tariff summary.
  - Internal/confidential appendix with sensitive details.
- Asset Management should allow fields to be marked as public summary vs internal note, without building a full document-permission system in v1.
- The report snapshot must preserve which fields were included in the public package and which were internal.

### 4. Investment Need Must Separate Renovation and New Investments

Current `V2VesinvestProject.investmentType` has `sanering`, `nyanlaggning`, and `reparation`, and current plans already compute yearly totals and five-year bands.

Direction:

- Preserve project-level editing, but make the law-facing summary explicitly show:
  - renovation/sanering separately from new investment/uusinvestointi/nyanläggning;
  - asset-category totals;
  - time buckets `0-5`, `6-10`, and `11-20` years;
  - near-term years in more detail than long-term years.
- Add readiness checks that fail if the 20-year summary cannot be produced by category and renovation/new-investment split.

### 5. Municipal Water-Services Plan Dependency

The asset-management plan must explain how the municipality's water-services plan forecasts and development needs were considered, including:

- new network areas;
- shrinking/supistuva areas;
- changes in service need;
- municipal development forecasts.

Direction:

- Add a municipal-plan context section to Asset Management.
- Start with manual fields and notes, not document import.
- Include the municipal-plan assumptions in report snapshots.
- Let missing municipal-plan context be a warning/readiness blocker depending on customer policy.

### 6. Financial Risk Must Be Broader

Current Tariff Plan has `financialRiskAssessment` in `V2TariffAllocationPolicy`, but the risk model needs to be broader and should live primarily in Asset Management.

Risk should include:

- cost inflation;
- increased purchased-service needs;
- major investment waves;
- reduced connection counts;
- changed demand from large consumers;
- ability to operate reliably;
- need for inter-utility cooperation or merger;
- execution capacity: staff, designers, contractors, procurement quality, and site supervision.

Direction:

- Add an Asset Management risk section with structured risk categories and free-text evidence.
- Tariff Plan should consume the accepted/visible financial risk summary instead of owning the only risk text.
- Reports should snapshot the risk summary and unresolved risk assumptions.

### 7. Tariff Plan Must Be Revenue-Table Based

Current `V2TariffBaselineInput`, `V2TariffAllocationPolicy`, and `V2TariffRecommendation` already support four fee levers:

- connection fee;
- base fee;
- water usage fee;
- wastewater usage fee.

The webinar examples frame the law-facing tariff analysis as revenue and cost tables, not only unit price recommendations.

Direction:

- Tariff Plan must show current and proposed annual revenue by fee type:
  - water usage-fee revenue;
  - water base-fee revenue;
  - wastewater usage-fee revenue;
  - wastewater base-fee revenue;
  - connection-fee revenue;
  - total revenue.
- Tariff Plan must show annual percentage change, preferably year by year for at least ten years where a smoothing path is used.
- The recommendation should preserve both price/unit changes and revenue impact.
- The current `fees: Record<V2TariffFeeKey, V2TariffFeeRecommendation>` should be extended, not replaced.

### 8. Tariff Plan Needs Cost Tables

The examples identify cost categories that should be visible in the tariff evidence:

- materials, supplies, and goods;
- purchased services;
- personnel costs;
- financing costs;
- other costs;
- total costs.

Direction:

- Forecast can remain the calculation engine.
- Tariff Plan should expose the cost categories used or assumed for tariff justification.
- v1 can use manual/current-year values plus forecast-derived values where available.
- Reports should snapshot the cost table used for the tariff recommendation.

### 9. Connection Fee Liability and Owner Distributions

Two concrete assumptions are missing from the current model:

- refundable/returnable connection fees and whether they may need to be returned;
- owner distributions/tuloutus and their impact on tariffs and investment capacity.

Direction:

- Add manual fields for returnable connection-fee liability and expected returns.
- Add manual fields for owner distributions and their effect on annual funding capacity.
- Readiness should not necessarily block all tariff planning if values are unknown, but unresolved assumptions must be explicit in Tariff Plan and Reports.

### 10. Regional Differentiation Is Stronger Than a Soft Flag

The current plan kept regional pricing as a v1 readiness flag. The webinar material is stronger:

- base fees and connection fees must differ by area when needed for correct cost allocation, causation principle, or similar grounds;
- usage fees may also differ on the same grounds;
- connection fee may consider property use purpose.

Direction:

- v1 may still avoid full area-specific tariff packages.
- But regional differentiation should be a structured readiness section, not only a boolean.
- Capture:
  - whether regional variation may be required;
  - which fee types are affected;
  - reason: cost allocation, causation, property-use purpose, or other;
  - whether separate package calculation is deferred.

### 11. Water Conservation and Wastewater Quality

Fees may consider:

- need to steer water consumption;
- special water use;
- exceptional wastewater quality or quantity;
- incentives for reducing wastewater amount and harmful substances.

Direction:

- Add readiness notes/flags to Tariff Plan.
- Do not build full industrial wastewater tariff modelling in v1.
- Reports should include any unresolved special-use or exceptional-wastewater assumptions.

### 12. Stormwater Needs Ownership and Funding Context

Current plan treated stormwater/hulevesi as a flag/export note. Raisio's example shows a more nuanced case: stormwater assets may sit on the utility balance sheet while maintenance/depreciation are covered by municipal/public stormwater fee arrangements.

Direction:

- Keep stormwater calculation out of v1.
- Upgrade the flag to structured context:
  - asset ownership;
  - whether on utility balance sheet;
  - funding arrangement;
  - whether costs/depreciation are covered by municipality/public fee;
  - unresolved assumptions.

### 13. Execution Capacity Is a Real Constraint

Tariff increases alone may not increase renovation volume if the utility lacks contractors, designers, staff, procurement quality criteria, or site supervision capacity.

Direction:

- Add an execution-capacity risk section in Asset Management.
- Forecast/Tariff Plan should distinguish "funding gap" from "delivery capacity gap".
- Reports should explain whether the proposed tariff path is actionable or only financially sufficient.

### 14. Communication Is Part of the Product

Kymen Vesi's example emphasizes plain-language, repeated communication about what fees cover.

Direction:

- Reports should include a communication summary for board/municipality/customer use.
- Tariff Plan should generate a short plain-language explanation of:
  - what changes;
  - why;
  - what the fees fund;
  - what is still uncertain.
- Avoid invented marketing copy in UI until accepted; start with editable text blocks and report snapshots.

## Implementation Plan Grounded In Current Code

### Current Code Baseline

The current implementation already provides these foundations:

- V2 shell has five tabs in `apps/web/src/v2/AppShellV2.tsx` and `apps/web/src/v2/appShellV2Routing.ts`: Overview, Asset Management, Forecast, Tariff Plan, Reports.
- Asset Management is mounted via `apps/web/src/v2/AssetManagementPageV2.tsx` and mostly delegates to `VesinvestPlanningPanel`.
- Asset planning data is persisted through Prisma models `VesinvestPlan`, `VesinvestProject`, and `VesinvestProjectAllocation`.
- Tariff Plan has first-class persistence through `VesinvestTariffPlan` and service logic in `apps/api/src/v2/v2-tariff-plan.service.ts`.
- Web tariff DTOs exist in `apps/web/src/api/v2/types/vesinvest.ts`.
- API tariff DTOs exist in `apps/api/src/v2/v2-tariff-plan.types.ts`.
- Report creation already requires an accepted tariff plan in `apps/api/src/v2/v2-report.service.ts`.
- Report snapshots already include tariff plan data through report types under `apps/web/src/api/v2/types/reports.ts` and backend report snapshot logic.
- Report readiness is centralized in `apps/web/src/v2/reportReadinessModel.ts` and `apps/web/src/v2/useReportsPageViewModel.ts`.

The next implementation should extend these surfaces rather than introduce a separate planning system.

### Phase 1: Canonical Data Shape

Goal: add the missing law-direction concepts without breaking existing Vesinvest plans.

#### Backend Persistence

Add nullable JSON fields to `VesinvestPlan` first, because these concepts are plan-version evidence and can evolve without immediate relational complexity:

- `assetEvidenceState Json?`
- `municipalPlanContext Json?`
- `maintenanceEvidenceState Json?`
- `conditionStudyState Json?`
- `financialRiskState Json?`
- `publicationState Json?`
- `communicationState Json?`

Add nullable JSON fields to `VesinvestTariffPlan` for tariff-specific evidence:

- `revenueEvidence Json?`
- `costEvidence Json?`
- `regionalDifferentiationState Json?`
- `stormwaterState Json?`
- `specialUseState Json?`
- `connectionFeeLiabilityState Json?`
- `ownerDistributionState Json?`

Reasoning:

- Existing project/allocation tables are good for investment rows.
- The new evidence sections are policy/evidence objects that will change as guidance matures.
- JSON keeps old plans readable and avoids premature table design.
- Later, high-volume asset register or area-specific tariff packages can become relational.

Files:

- `apps/api/prisma/schema.prisma`
- new Prisma migration under `apps/api/prisma/migrations/**`
- API mapper/update support in `apps/api/src/v2/v2-vesinvest-plan-support.ts`
- Vesinvest service update paths in `apps/api/src/v2/v2-vesinvest.service.ts`
- Tariff service update paths in `apps/api/src/v2/v2-tariff-plan.service.ts`

#### Shared DTOs

Extend API/web types with these concepts:

- `V2AssetEvidenceState`
- `V2ConditionStudyState`
- `V2MaintenanceEvidenceState`
- `V2MunicipalPlanContext`
- `V2FinancialRiskState`
- `V2PublicationState`
- `V2CommunicationState`
- `V2TariffRevenueEvidence`
- `V2TariffCostEvidence`
- `V2RegionalDifferentiationState`
- `V2StormwaterState`
- `V2SpecialUseState`
- `V2ConnectionFeeLiabilityState`
- `V2OwnerDistributionState`

Files:

- `apps/web/src/api/v2/types/vesinvest.ts`
- `apps/api/src/v2/v2-tariff-plan.types.ts`
- existing backend contract/mapping helpers in `apps/api/src/v2/vesinvest-contract.ts` if these values are snapshotted into reports

Acceptance:

- Existing plans load with all new fields as `null` or default empty states.
- Create/update plan accepts the new asset-management evidence objects.
- Save tariff plan accepts the new tariff evidence objects.
- No existing report creation path breaks when evidence is missing.

Tests:

- API type/persistence tests in `apps/api/src/v2/v2-vesinvest.service.spec.ts`.
- Tariff persistence tests in `apps/api/src/v2/v2-tariff-plan.service.spec.ts`.
- Legacy compatibility tests for old plans and old reports.

### Phase 2: Asset Management Evidence UI

Goal: make Asset Management the place where law evidence is completed, not only investment rows.

#### Page Structure

Keep `AssetManagementPageV2` and `VesinvestPlanningPanel`, but split the current panel into clearer workspace sections:

- Plan identity and lifecycle.
- Asset inventory and data gaps.
- Condition studies.
- Maintenance and service tracking.
- Investment and financing need.
- Municipal-plan dependency.
- Financial and execution-capacity risks.
- Publication and communication.
- Sync to Forecast.

Current UI already has `VesinvestWorkspaceTabs`; extend it rather than creating another top-level shell route.

Files:

- `apps/web/src/v2/VesinvestPlanningPanel.tsx`
- `apps/web/src/v2/vesinvestPlanningChrome.tsx`
- `apps/web/src/v2/vesinvestPlanningReviewSections.tsx`
- `apps/web/src/v2/vesinvestPlanningInvestmentWorkspace.tsx`
- `apps/web/src/v2/useVesinvestPlanningController.ts`
- `apps/web/src/v2/vesinvestPlanningModel.ts`
- `apps/web/src/i18n/locales/en.json`
- `apps/web/src/i18n/locales/fi.json`
- `apps/web/src/i18n/locales/sv.json`

#### Asset Inventory and Data Gaps

Add editable evidence for:

- asset categories included;
- whether networks are in GIS/location-data form;
- age/material/condition coverage;
- missing information;
- plan to complete missing information;
- sensitive/confidential information note.

Do not build an asset register in v1. This is a structured summary and readiness object.

#### Condition Studies

Add editable rows/summary fields for:

- method;
- target asset category;
- recurrence/frequency;
- latest study date;
- next planned study;
- basis of condition assessment;
- whether critical assets are prioritized.

#### Maintenance Evidence

Add summary fields for:

- maintenance documents;
- service log or service book;
- pump-station rounds and other recurring maintenance;
- how completion is monitored;
- unresolved maintenance evidence gaps.

#### Municipal Plan Context

Add fields for:

- municipal plan reference/date;
- demand forecast considered;
- new network areas considered;
- shrinking areas considered;
- impact on new investments;
- unresolved municipal-plan assumptions.

#### Financial and Execution Capacity Risks

Add structured risk items:

- risk category;
- probability/impact;
- evidence/notes;
- mitigation;
- whether it affects funding, delivery capacity, or both.

Seed categories:

- cost inflation;
- purchased services;
- major investment wave;
- connection decline;
- large consumer demand change;
- reliability/continuity;
- cooperation/merger need;
- staff capacity;
- contractor/designer capacity;
- procurement/site-supervision quality.

Acceptance:

- Asset Management can save and reload every new evidence section.
- Status/readiness reflects missing data gaps, missing condition-study basis, missing maintenance summary, missing municipal-plan context, and missing risk summary.
- Existing investment edit, depreciation class review, sync-to-forecast, and report handoff continue to work.

Tests:

- `VesinvestPlanningPanel.*.test.tsx` suites for save/reload and readiness messaging.
- API persistence tests for `VesinvestPlan` evidence JSON.
- Locale integrity tests.

### Phase 3: Law-Ready Investment Summary

Goal: make the existing investment data produce the required law-facing 20-year summary.

Current code already has:

- project type: `sanering`, `nyanlaggning`, `reparation`;
- group/category fields;
- yearly allocations;
- five-year bands.

Add:

- summary by investment type;
- summary by asset category;
- time buckets `0-5`, `6-10`, `11-20`;
- explicit renovation vs new-investment view;
- funding need summary that separates total investment need from annual tariff/revenue pressure.

Files:

- `apps/api/src/v2/v2-vesinvest-plan-support.ts`
- `apps/web/src/api/v2/types/vesinvest.ts`
- `apps/web/src/v2/useVesinvestPlanningDerivedState.ts`
- `apps/web/src/v2/vesinvestPlanningReviewSections.tsx`
- `apps/web/src/v2/vesinvestPlanningInvestmentWorkspace.tsx`

Acceptance:

- Every plan response includes law-facing investment summaries.
- Asset Management displays these summaries.
- Tariff Plan can consume the summaries without recomputing from raw project rows in the browser.

Tests:

- API summary calculation tests.
- Web render tests for split by type/category/bucket.

### Phase 4: Tariff Evidence Upgrade

Goal: turn Tariff Plan from a four-lever price surface into the law-facing revenue/cost/assumption package.

#### Extend Tariff Baseline

Current `V2TariffBaselineInput` has:

- connection fee average/revenue/new connections/basis;
- base-fee revenue and connection count;
- water/wastewater prices and volumes;
- notes.

Extend to explicit revenue evidence:

- water usage-fee revenue;
- water base-fee revenue;
- wastewater usage-fee revenue;
- wastewater base-fee revenue;
- connection-fee revenue;
- other fee revenue;
- total revenue;
- current year and source note.

Keep derived values where possible, but allow manual overrides.

#### Add Tariff Cost Evidence

Add:

- materials/supplies/goods;
- purchased services;
- personnel;
- financing costs;
- other costs;
- total costs;
- cost source note.

Forecast remains the calculation engine; Tariff Plan owns the visible evidence table.

#### Add Missing Assumptions

Add structured inputs for:

- returnable connection-fee liability;
- expected connection-fee returns;
- owner distributions/tuloutus;
- owner-distribution impact note;
- regional differentiation state;
- stormwater ownership/funding state;
- special water use and exceptional wastewater quality/quantity state.

Files:

- `apps/web/src/api/v2/types/vesinvest.ts`
- `apps/api/src/v2/v2-tariff-plan.types.ts`
- `apps/api/src/v2/v2-tariff-plan.service.ts`
- `apps/web/src/v2/TariffPlanPageV2.tsx`
- likely new subcomponents under `apps/web/src/v2/tariffPlan*.tsx`

Acceptance:

- Save/reload preserves revenue, cost, and missing-assumption evidence.
- Readiness checklist lists unresolved assumptions by category.
- Existing four fee recommendation sections still render and remain editable.
- Accepted tariff plan snapshots all evidence into reports.

Tests:

- API tests for save/reload and readiness.
- Web tests for editing evidence and unresolved assumptions.
- Report snapshot stability tests.

### Phase 5: Tariff Calculation Upgrade

Goal: make `V2TariffRecommendation` law-facing while keeping current calculation behavior stable.

Current `V2TariffRecommendation` includes:

- target additional annual revenue;
- baseline annual revenue;
- proposed annual revenue;
- smoothing years;
- average annual increase percent;
- fee recommendations by four fee types;
- law readiness.

Extend recommendation with:

- `revenueTable` by fee type and year;
- `costTable` by cost type and year/current period;
- `annualChangeTable` for at least 10 years when smoothing applies;
- `consumerImpactFlags`:
  - annual percentage over 15%;
  - annual euro impact threshold for base fee where data exists;
  - missing impact denominator;
- `allocationRationale`:
  - fixed vs variable logic;
  - water/wastewater service split;
  - connection-fee assumptions;
  - manual overrides.

Update smoothing:

- preserve current 15% status;
- add optional 150 EUR/year base-fee impact check when the required baseline exists;
- do not block acceptance solely because 15% is exceeded if the plan explicitly records the rationale and customer impact context, unless business policy says otherwise.

Files:

- `apps/api/src/v2/v2-tariff-plan.service.ts`
- `apps/api/src/v2/v2-tariff-plan.types.ts`
- `apps/web/src/api/v2/types/vesinvest.ts`
- `apps/web/src/v2/TariffPlanPageV2.tsx`
- report snapshot types and renderers.

Acceptance:

- Recommendation contains current/proposed revenue and annual change by fee type.
- Recommendation exposes unresolved assumptions separately from hard blockers.
- Existing accepted tariff plan logic still requires current baseline, trusted baseline, investment need, and risk assessment.

Tests:

- Calculation tests for revenue tables.
- Calculation tests for 15% and 150 EUR impact.
- Missing denominator tests.
- Manual override tests.

### Phase 6: Reports and Snapshots

Goal: reports become the official snapshot of baseline, asset-management evidence, tariff evidence, and law readiness.

Current report creation already checks:

- Vesinvest plan identity;
- current forecast scenario;
- baseline fingerprint;
- accepted tariff plan.

Extend report snapshots with:

- asset evidence state;
- condition-study state;
- maintenance evidence state;
- municipal-plan context;
- financial and execution-capacity risk state;
- publication state;
- communication state;
- tariff revenue evidence;
- tariff cost evidence;
- regional differentiation state;
- stormwater state;
- special-use state;
- returnable connection-fee state;
- owner-distribution state;
- final law-readiness checklist.

Report modes:

- Public summary.
- Internal/confidential appendix.

Files:

- `apps/api/src/v2/v2-report.service.ts`
- `apps/api/src/v2/v2-report.types.ts`
- `apps/api/src/v2/v2-report-pdf.ts`
- `apps/web/src/api/v2/types/reports.ts`
- `apps/web/src/v2/ReportsPageV2.tsx`
- `apps/web/src/v2/reportsPageSections.tsx`
- `apps/web/src/v2/reportReadinessModel.ts`
- `apps/web/src/v2/useReportsPageViewModel.ts`

Acceptance:

- Report creation snapshots accepted evidence and does not recompute from live mutable state.
- Existing reports remain readable.
- Public/internal report variants do not leak confidential fields into public output.
- Report readiness explains exactly which section blocks report creation.

Tests:

- API report snapshot tests.
- PDF/report rendering tests.
- Legacy report compatibility tests.
- Web readiness and export tests.

### Phase 7: Shell Status and Workflow Readiness

Goal: keep the five-tab shell accurate as evidence requirements grow.

Current shell status logic lives in:

- `apps/web/src/v2/AppShellV2.tsx`
- `apps/web/src/v2/appShellV2Chrome.tsx`
- `apps/web/src/v2/appShellV2Routing.ts`

Extend shell bootstrap snapshot with minimal booleans:

- `assetEvidenceReady`
- `assetPlanCurrent`
- `municipalPlanContextReady`
- `conditionMaintenanceReady`
- `riskReady`
- `tariffEvidenceReady`
- `reportPackageReady`

Rules:

- Overview stays baseline/evidence desk.
- Asset Management is positive only when plan evidence and 20-year investment summary are ready/current.
- Forecast is positive only when linked scenario is computed and current and the runtime scenario is not off the linked fee path.
- Tariff Plan is positive only when accepted and evidence-ready.
- Reports is positive only when accepted tariff, current forecast, no plan drift, and report package readiness all pass.

Acceptance:

- Status dots do not claim ready when evidence sections are missing.
- Reports remains reachable after baseline unlock but creation/export remains blocked until readiness passes.

Tests:

- AppShell status tests for missing asset evidence, missing municipal context, stale tariff evidence, and report-ready state.

### Phase 8: Communication Summary

Goal: include communication support without inventing uncontrolled copy.

Add editable fields:

- short board summary;
- short customer/plain-language explanation;
- what fees cover;
- what changes;
- why now;
- uncertainties/assumptions.

Do not auto-generate final public copy in v1. The app can propose structure, but user-owned editable text is the canonical content.

Files:

- `VesinvestPlan.communicationState`
- Asset Management communication section.
- Report snapshot and public report rendering.

Acceptance:

- Communication text is editable and snapshotted.
- Reports can include or exclude communication section by variant.

### Phase 9: Migration and Compatibility Strategy

Rules:

- New fields must be nullable.
- Existing Vesinvest plans must load with default empty evidence states.
- Existing reports must render without new snapshot sections.
- Legacy `feeRecommendation` remains readable as old forecast-derived output.
- Accepted `VesinvestTariffPlan` remains the source of truth for new report snapshots.

Recommended migration order:

1. Add nullable JSON columns and DTO defaults.
2. Add backend read/write mapping.
3. Add API tests for legacy rows.
4. Add UI sections behind current Asset Management and Tariff Plan pages.
5. Add report snapshot extensions.
6. Add stricter readiness only after evidence can be entered and saved.

### Phase 10: Suggested Sprint Breakdown

#### S-Asset-1: Plan Evidence Persistence

Files:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/api/src/v2/v2-vesinvest.service.ts`
- `apps/api/src/v2/v2-vesinvest-plan-support.ts`
- `apps/web/src/api/v2/types/vesinvest.ts`
- Vesinvest API tests

Acceptance:

- Plan evidence JSON fields save/reload.
- Old plans load.

#### S-Asset-2: Asset Evidence UI

Files:

- `apps/web/src/v2/VesinvestPlanningPanel.tsx`
- `apps/web/src/v2/vesinvestPlanningChrome.tsx`
- `apps/web/src/v2/vesinvestPlanningReviewSections.tsx`
- `apps/web/src/v2/useVesinvestPlanningController.ts`
- `apps/web/src/i18n/locales/*.json`
- Vesinvest panel tests

Acceptance:

- User can edit inventory/data gap, condition, maintenance, municipal plan, and risk sections.
- Readiness reflects missing evidence.

#### S-Asset-3: Law-Facing Investment Summary

Files:

- `apps/api/src/v2/v2-vesinvest-plan-support.ts`
- `apps/web/src/api/v2/types/vesinvest.ts`
- `apps/web/src/v2/useVesinvestPlanningDerivedState.ts`
- `apps/web/src/v2/vesinvestPlanningInvestmentWorkspace.tsx`

Acceptance:

- Summary by category/type/bucket exists and renders.

#### S-Tariff-1: Tariff Evidence Persistence

Files:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/api/src/v2/v2-tariff-plan.service.ts`
- `apps/api/src/v2/v2-tariff-plan.types.ts`
- `apps/web/src/api/v2/types/vesinvest.ts`

Acceptance:

- Revenue, cost, regional, stormwater, special-use, connection-liability, and owner-distribution evidence saves/reloads.

#### S-Tariff-2: Tariff Evidence UI

Files:

- `apps/web/src/v2/TariffPlanPageV2.tsx`
- potential new `apps/web/src/v2/tariffPlan*.tsx`
- `apps/web/src/i18n/locales/*.json`
- tariff web tests

Acceptance:

- User can edit all evidence sections.
- Readiness panel shows unresolved assumptions.

#### S-Tariff-3: Recommendation Upgrade

Files:

- `apps/api/src/v2/v2-tariff-plan.service.ts`
- `apps/api/src/v2/v2-tariff-plan.types.ts`
- `apps/web/src/api/v2/types/vesinvest.ts`
- `apps/web/src/v2/TariffPlanPageV2.tsx`

Acceptance:

- Recommendation includes revenue tables, cost tables, annual change path, and impact flags.

#### S-Report-1: Snapshot Extension

Files:

- `apps/api/src/v2/v2-report.service.ts`
- `apps/api/src/v2/v2-report.types.ts`
- `apps/web/src/api/v2/types/reports.ts`
- report API tests

Acceptance:

- Reports snapshot accepted asset/tariff evidence.
- Old reports remain readable.

#### S-Report-2: Public/Internal Report Packages

Files:

- `apps/api/src/v2/v2-report-pdf.ts`
- `apps/web/src/v2/reportsPageSections.tsx`
- `apps/web/src/v2/ReportsPageV2.tsx`
- report rendering tests

Acceptance:

- Public summary excludes internal/confidential fields.
- Internal appendix includes full evidence.

#### S-Shell-1: Readiness Bootstrap

Files:

- `apps/api/src/v2/v2-planning-context*` or current context builder
- `apps/web/src/v2/AppShellV2.tsx`
- `apps/web/src/v2/appShellV2Routing.ts`
- AppShell tests

Acceptance:

- Tab status reflects new evidence readiness.
- Reports remains reachable after baseline, but report creation remains blocked until evidence readiness passes.

#### S-Communication-1: Editable Communication Summary

Files:

- `apps/web/src/v2/VesinvestPlanningPanel.tsx`
- report snapshot/rendering files
- locale files

Acceptance:

- Board/customer communication text is editable and snapshotted.

### Verification Bundle

Minimum targeted verification after each implementation slice:

- `pnpm --filter ./apps/web typecheck`
- `pnpm --filter ./apps/api typecheck`
- relevant web tests for AppShell, VesinvestPlanningPanel, TariffPlanPageV2, ReportsPageV2
- relevant API tests for Vesinvest, tariff plan, and reports

Full milestone verification:

- `pnpm --filter ./apps/web test -- src/v2/AppShellV2*.test.tsx src/v2/VesinvestPlanningPanel*.test.tsx src/v2/ReportsPageV2*.test.tsx src/i18n/locales/localeIntegrity.test.ts`
- `pnpm --filter ./apps/web typecheck`
- `pnpm --filter ./apps/api test -- src/v2/v2-vesinvest.service.spec.ts src/v2/v2-tariff-plan.service.spec.ts src/v2/v2-report.service.spec.ts`
- `pnpm --filter ./apps/api typecheck`

## Open Product Decisions

- Should missing municipal-plan context be a hard blocker or a warning in v1?
- Should missing condition-study recurrence be a hard blocker or a warning in v1?
- Should 15% annual increase be a hard blocker, or should it allow acceptance with rationale and customer-impact explanation?
- Should public/internal report split be implemented first in HTML/web report preview or PDF export?
- Should regional differentiation remain a structured readiness object in v1, or do we need the first area-specific calculation package earlier?
- How much Swedish/Finnish/English communication copy should be prefilled vs user-owned editable text?

