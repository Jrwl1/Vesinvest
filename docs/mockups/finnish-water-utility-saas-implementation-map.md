# V5 implementation map

This maps the v5 mockup deltas onto the current V2 code and test surface in `apps/web/src/v2/**`.

## 1. Step 2 include control

### UI target
Replace the current year-card inclusion state/action mix with one explicit binary control: `Mukana / Ei mukana`.

### Primary files
- `apps/web/src/v2/OverviewImportBoard.tsx`
- `apps/web/src/v2/useOverviewImportController.ts`
- `apps/web/src/v2/overviewWorkflow.ts`
- `apps/web/src/v2/v2.css`

### Why these files
- `OverviewImportBoard.tsx` renders the Step 2 year cards and already receives `selectedYears` plus `onToggleYear`.
- `useOverviewImportController.ts` is the right place if toggle semantics or selection side-effects need tightening.
- `overviewWorkflow.ts` owns presented-step logic and year readiness helpers that shape board state.
- `v2.css` will need the segmented-control styling and spacing adjustments.

### Likely test updates
- `apps/web/src/v2/OverviewPageV2.test.tsx`
- `apps/web/src/i18n/locales/localeIntegrity.test.ts`
- locale files if new explicit include-state labels are introduced:
  - `apps/web/src/i18n/locales/fi.json`
  - `apps/web/src/i18n/locales/sv.json`
  - `apps/web/src/i18n/locales/en.json`

## 2. Step 3 derived `Tulos` and provenance

### UI target
Keep `Tulos` derived by default, show a short provenance line such as `Perustuu yllä oleviin riveihin`, and keep `Tallenna ja hyväksy` as the dominant action.

### Primary files
- `apps/web/src/v2/OverviewYearWorkspace.tsx`
- `apps/web/src/v2/useOverviewManualPatchEditor.ts`
- `apps/web/src/v2/overviewManualForms.ts`
- `apps/web/src/v2/yearReview.ts`
- `apps/web/src/v2/v2.css`

### Why these files
- `OverviewYearWorkspace.tsx` renders the review workspace fields and is the natural place to make the derived-result block visually distinct.
- `useOverviewManualPatchEditor.ts` controls what is editable and what payload is sent when manual fixes are saved.
- `overviewManualForms.ts` already contains `deriveAdjustedYearResult`, which is the semantic anchor for computed `Tulos`.
- `yearReview.ts` defines the canonical comparison rows and trust signals used in review mode.
- `v2.css` will need the refined derived-block and action hierarchy styling.

### Likely test updates
- `apps/web/src/v2/OverviewPageV2.test.tsx`
- `apps/web/src/v2/yearReview.test.ts`

## 3. Support rail compression

### UI target
Keep only a compact status panel plus a next-action panel in Step 2 and Step 3.

### Primary files
- `apps/web/src/v2/OverviewSupportRail.tsx`
- `apps/web/src/v2/OverviewPageV2.tsx`
- `apps/web/src/v2/OverviewWizardPanels.tsx`
- `apps/web/src/v2/v2.css`

### Why these files
- `OverviewSupportRail.tsx` is the direct surface for this reduction.
- `OverviewPageV2.tsx` orchestrates step-specific data passed into the rail.
- `OverviewWizardPanels.tsx` may need minor prop or composition cleanup if duplicate guidance still leaks from the step body.

## 4. `Ennuste` operator-density pass

### UI target
Make `Ennuste` feel denser and more instrument-like while keeping the same shell and tokens: stronger active scenario state, more chart dominance, clearer primary workbench.

### Primary files
- `apps/web/src/v2/EnnustePageV2.tsx`
- `apps/web/src/v2/ForecastScenarioStrip.tsx`
- `apps/web/src/v2/ForecastCockpitSurface.tsx`
- `apps/web/src/v2/ForecastInvestmentSurface.tsx`
- `apps/web/src/v2/v2.css`

### Why these files
- `EnnustePageV2.tsx` controls the top-level board order and where the scenario strip, cockpit, and workbench surfaces sit.
- `ForecastScenarioStrip.tsx` is the natural place to strengthen active/inactive hierarchy.
- `ForecastCockpitSurface.tsx` is where chart context, freshness, and source labels should live.
- `ForecastInvestmentSurface.tsx` is the current home of the primary planning workbench and likely entry point for the stronger `Poistosuunnitelmat` emphasis.
- `v2.css` will carry density, spacing, and hierarchy changes.

### Likely test updates
- `apps/web/src/v2/EnnustePageV2.test.tsx`

## 5. `Raportit` document-header cue

### UI target
Keep the metadata-first layout, but add a stronger document-object header before the detailed metadata grid.

### Primary files
- `apps/web/src/v2/ReportsPageV2.tsx`
- `apps/web/src/v2/displayNames.ts`
- `apps/web/src/v2/v2.css`

### Why these files
- `ReportsPageV2.tsx` owns report list selection, preview metadata, readiness, and export CTA hierarchy.
- `displayNames.ts` already formats scenario and report naming; it may be the right place if the header needs a slightly different display treatment.
- `v2.css` will need the document-header layout and calmer metadata composition.

### Likely test updates
- `apps/web/src/v2/ReportsPageV2.test.tsx`

## 6. Locale and copy constraints

### Keep grounded in repo truth
Use existing locale keys where possible. The current Swedish file already contains the important base strings:
- `wizardQuestionConnect`
- `wizardQuestionImportYears`
- `wizardQuestionReviewYears`
- `wizardQuestionBaseline`
- `wizardQuestionForecast`
- `openForecast`
- `variantPublic`
- `variantConfidential`
- `createReport`
- `exportPdf`
- `depreciationRulesTitle`

### Likely new or adjusted keys only if needed
Only add locale keys if the implementation truly introduces a new visible label for:
- include-state segmentation
- derived-result provenance
- document header field labels

## 7. Suggested verification slice

Use the narrowest likely command set after implementation:

```bash
pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts
pnpm --filter ./apps/web typecheck
```

## 8. Recommended execution order

1. Step 2 include control and support rail cleanup.
2. Step 3 derived `Tulos` treatment and action hierarchy.
3. `Ennuste` density and active-scenario hierarchy.
4. `Raportit` document-header cue.
5. Locale integrity and Swedish render check.

## 9. Current risk note

The relevant implementation files are already dirty in the working tree:
- `apps/web/src/v2/OverviewImportBoard.tsx`
- `apps/web/src/v2/OverviewPageV2.tsx`
- `apps/web/src/v2/useOverviewImportController.ts`
- `apps/web/src/v2/useOverviewPageController.ts`
- `apps/web/src/v2/useOverviewSetupState.ts`
- `apps/web/src/v2/v2.css`
- locale files and locale integrity test

That means the safest next implementation pass is to reconcile those in-place rather than starting with a blind patch.
