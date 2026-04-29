import type { TFunction } from 'i18next';
import React from 'react';

import type { V2PlanningContextResponse } from '../api';
import { useVesinvestPlanningController } from './useVesinvestPlanningController';
import {
  VesinvestDerivedTotalsStrip,
  VesinvestPanelHeader,
  VesinvestPlanStatusStrip,
  VesinvestPlanningActionRow,
  VesinvestProjectComposerDialog,
  VesinvestRevisionSummary,
  VesinvestWorkspaceTabs,
} from './vesinvestPlanningChrome';
import { VesinvestPlanningInvestmentWorkspace } from './vesinvestPlanningInvestmentWorkspace';
import { type VesinvestLinkedOrg } from './vesinvestPlanningModel';
import {
  assetEvidenceFields,
  VesinvestAssetEvidenceSection,
  VesinvestBaselineReviewSection,
  VesinvestDepreciationPlanSection,
  VesinvestUtilityBindingSection,
} from './vesinvestPlanningReviewSections';
import { VesinvestRevisionSurface } from './vesinvestPlanningSections';

type Props = {
  t: TFunction;
  isAdmin?: boolean;
  simplifiedSetup?: boolean;
  compactReviewMode?: boolean;
  planningContext: V2PlanningContextResponse | null;
  linkedOrg: VesinvestLinkedOrg;
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  overviewFocusTarget?: VesinvestOverviewFocusTarget | null;
  onOverviewFocusTargetConsumed?: () => void;
  onSavedFeePathReportConflict?: (planId?: string | null) => void;
  onPlansChanged?: () => Promise<void> | void;
};

export type VesinvestOverviewFocusTarget = {
  kind: 'saved_fee_path';
  planId: string;
};

export const VesinvestPlanningPanel: React.FC<Props> = ({
  t,
  isAdmin = false,
  simplifiedSetup = false,
  compactReviewMode = false,
  planningContext,
  linkedOrg,
  onGoToForecast,
  onGoToReports,
  overviewFocusTarget,
  onOverviewFocusTargetConsumed,
  onSavedFeePathReportConflict,
  onPlansChanged,
}) => {
  const controller = useVesinvestPlanningController({
    t,
    isAdmin,
    simplifiedSetup,
    compactReviewMode,
    planningContext,
    linkedOrg,
    onGoToForecast,
    onGoToReports,
    overviewFocusTarget,
    onOverviewFocusTargetConsumed,
    onSavedFeePathReportConflict,
    onPlansChanged,
  });

  const assetEvidenceMissingLabels = React.useMemo(
    () =>
      assetEvidenceFields
        .filter((field) => {
          const value = controller.draft[field.key];
          return (
            value == null ||
            typeof value !== 'object' ||
            Array.isArray(value) ||
            typeof (value as { notes?: unknown }).notes !== 'string' ||
            (value as { notes: string }).notes.trim().length === 0
          );
        })
        .map((field) => t(field.labelKey, field.fallbackLabel)),
    [controller.draft, t],
  );

  const loadingState =
    controller.loading || controller.loadingPlan ? (
      <div className="v2-loading-state">
        <p>{t('common.loading', 'Loading...')}</p>
        <div className="v2-skeleton-line" />
      </div>
    ) : null;

  if (compactReviewMode) {
    return (
      <section className="v2-card v2-vesinvest-panel v2-vesinvest-panel-compact">
        <VesinvestPanelHeader
          t={t}
          useSimplifiedSetup={true}
          plans={[]}
          selectedPlanId={null}
          hasUnsavedChanges={false}
          loading={false}
          busy={false}
          onSelectPlan={() => undefined}
        />
        {controller.error ? <div className="v2-alert v2-alert-error">{controller.error}</div> : null}
        {controller.info ? <div className="v2-alert v2-alert-info">{controller.info}</div> : null}
        {loadingState}
      </section>
    );
  }

  const actionRow = (
    <VesinvestPlanningActionRow
      t={t}
      activeWorkspaceView={controller.activeWorkspaceView}
      projectActionClass={controller.projectActionClass}
      saveActionClass={controller.saveActionClass}
      syncActionClass={controller.syncActionClass}
      reportActionClass={controller.reportActionClass}
      openProjectComposer={controller.openProjectComposer}
      busy={controller.busy}
      loading={controller.loading}
      loadingPlan={controller.loadingPlan}
      groupsCount={controller.groups.length}
      plan={controller.plan}
      utilityBindingMissing={controller.utilityBindingMissing}
      showDownstreamActions={controller.showDownstreamActions}
      pricingReady={controller.pricingReady}
      persist={controller.persist}
      onOpenReports={onGoToReports}
    />
  );

  const handleSelectPlan = (nextPlanId: string | null) => {
    if (
      nextPlanId !== controller.selectedPlanId &&
      controller.hasUnsavedChanges &&
      !window.confirm(
        t(
          'v2Vesinvest.unsavedChangesConfirm',
          'Discard unsaved Vesinvest changes and switch to another revision?',
        ),
      )
    ) {
      return;
    }
    controller.setSelectedPlanId(nextPlanId);
  };

  return (
    <section className="v2-card v2-vesinvest-panel">
      <VesinvestPanelHeader
        t={t}
        useSimplifiedSetup={controller.useSimplifiedSetup}
        plans={controller.plans}
        selectedPlanId={controller.selectedPlanId}
        hasUnsavedChanges={controller.hasUnsavedChanges}
        loading={controller.loading}
        busy={controller.busy}
        onSelectPlan={handleSelectPlan}
      />

      {controller.error ? <div className="v2-alert v2-alert-error">{controller.error}</div> : null}
      {controller.info ? <div className="v2-alert v2-alert-info">{controller.info}</div> : null}

      <VesinvestProjectComposerDialog
        t={t}
        busy={controller.busy}
        loading={controller.loading}
        loadingPlan={controller.loadingPlan}
        groups={controller.groups}
        projectComposer={controller.projectComposer}
        projectComposerGroupKey={controller.projectComposerGroupKey}
        setProjectComposer={controller.setProjectComposer}
        closeProjectComposer={controller.closeProjectComposer}
        handleCreateProjectDraft={controller.handleCreateProjectDraft}
      />

      <VesinvestUtilityBindingSection
        t={t}
        linkedOrg={linkedOrg}
        draft={controller.draft}
        utilityBindingMissing={controller.utilityBindingMissing}
        utilityBindingMismatch={controller.utilityBindingMismatch}
        veetiSearchQuery={controller.veetiSearchQuery}
        setVeetiSearchQuery={controller.setVeetiSearchQuery}
        veetiSearchResults={controller.veetiSearchResults}
        busy={controller.busy}
        searchingVeeti={controller.searchingVeeti}
        runVeetiLookup={controller.runVeetiLookup}
        applyVeetiSearchHit={controller.applyVeetiSearchHit}
      />

      {loadingState}

      <VesinvestDerivedTotalsStrip
        t={t}
        draft={controller.draft}
        yearTotals={controller.yearTotals}
        fiveYearBands={controller.fiveYearBands}
        forecastSyncLabel={controller.pricingReady
          ? t('v2Vesinvest.forecastSyncReady', 'Forecast sync ready')
          : controller.selectedSummary?.pricingStatus === 'provisional'
            ? t('v2Vesinvest.forecastSyncDraft', 'Forecast sync provisional')
            : t('v2Vesinvest.forecastSyncPending', 'Forecast sync pending')}
      />

      <VesinvestPlanStatusStrip
        t={t}
        draft={controller.draft}
        baselineVerified={controller.baselineVerified}
        showDownstreamActions={controller.showDownstreamActions}
        pricingStatus={controller.selectedSummary?.pricingStatus}
        hasSavedPricingOutput={controller.hasSavedPricingOutput}
        revisionStatusMessage={controller.revisionStatusMessage}
        pricingReady={controller.pricingReady}
        assetEvidenceReady={controller.assetEvidenceReady}
        assetEvidenceMissingCount={controller.assetEvidenceMissingCount}
        assetEvidenceMissingLabels={assetEvidenceMissingLabels}
      />

      <VesinvestWorkspaceTabs
        t={t}
        activeWorkspaceView={controller.activeWorkspaceView}
        setActiveWorkspaceView={controller.setActiveWorkspaceView}
      />

      <VesinvestDepreciationPlanSection
        t={t}
        active={controller.activeWorkspaceView === 'depreciation'}
        groupDrafts={controller.groupDrafts}
        depreciationRuleDrafts={controller.depreciationRuleDrafts}
        isAdmin={isAdmin}
        savingClassKey={controller.savingClassKey}
        updateGroupDraft={controller.updateGroupDraft}
        updateDepreciationRuleDraft={controller.updateDepreciationRuleDraft}
        handleSaveClassDefinition={controller.handleSaveClassDefinition}
      />

      {controller.useSimplifiedSetup ? null : (
        <>
          <VesinvestRevisionSurface>
            <VesinvestRevisionSummary
              t={t}
              actionRow={actionRow}
              draft={controller.draft}
              totalInvestments={controller.totalInvestments}
              reviewDueAt={controller.selectedSummary?.reviewDueAt}
              setDraftField={controller.setDraftField}
              setDraft={controller.setDraft}
            />
          </VesinvestRevisionSurface>

          <VesinvestBaselineReviewSection
            t={t}
            baselineYears={controller.baselineYears}
            baselineVerified={controller.baselineVerified}
            selectedSummary={controller.selectedSummary}
            feeRecommendation={controller.feeRecommendation}
            feePathSectionRef={controller.feePathSectionRef}
            feePathHeadingRef={controller.feePathHeadingRef}
          />

          <VesinvestAssetEvidenceSection
            t={t}
            active={controller.activeWorkspaceView === 'evidence'}
            draft={controller.draft}
            setDraft={controller.setDraft}
          />

          {controller.activeWorkspaceView === 'investment' ? (
            <VesinvestPlanningInvestmentWorkspace
              t={t}
              draft={controller.draft}
              groups={controller.groups}
              groupedPlanMatrix={controller.groupedPlanMatrix}
              yearTotals={controller.yearTotals}
              totalInvestments={controller.totalInvestments}
              lawInvestmentSummary={
                controller.hasUnsavedChanges ? null : controller.plan?.lawInvestmentSummary ?? null
              }
              busy={controller.busy}
              loading={controller.loading}
              loadingPlan={controller.loadingPlan}
              openProjectComposer={controller.openProjectComposer}
              updateProject={controller.updateProject}
              setDraft={controller.setDraft}
              updateProjectAllocation={controller.updateProjectAllocation}
            />
          ) : null}
        </>
      )}
    </section>
  );
};
