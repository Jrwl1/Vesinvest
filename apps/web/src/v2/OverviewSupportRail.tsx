import React from 'react';
import type { TFunction } from 'i18next';
import { PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS } from './overviewWorkflow';

type SummaryMetaBlock = {
  label: string;
  value: string;
};

type SummaryItem = {
  label: string;
  value: string;
  detail: string;
};

type SupportAction = {
  title: string;
  body: string;
};

type Props = {
  t: TFunction;
  workflowStep?: number;
  wizardDisplayStep?: number;
  isStep2SupportChrome: boolean;
  compactSupportingChrome: boolean;
  supportingChromeEyebrow: string;
  supportingChromeTitle: string;
  summaryMetaBlocks: readonly SummaryMetaBlock[];
  supportStatusItems: readonly SummaryItem[];
  nextAction: SupportAction;
};

export const OverviewSupportRail: React.FC<Props> = ({
  t,
  workflowStep,
  wizardDisplayStep,
  isStep2SupportChrome,
  compactSupportingChrome,
  supportingChromeEyebrow,
  supportingChromeTitle,
  summaryMetaBlocks,
  supportStatusItems,
  nextAction,
}) => {
  const displayedStep = workflowStep ?? wizardDisplayStep ?? 1;
  return (
    <aside
      className={`v2-card v2-overview-progress-card v2-overview-support-rail v2-overview-wizard-card ${
        compactSupportingChrome ? 'compact' : ''
      } ${isStep2SupportChrome ? 'step2-support' : ''}`.trim()}
    >
      <div className="v2-overview-support-panel">
        <div className="v2-section-header">
          <div>
            <p className="v2-overview-eyebrow">{supportingChromeEyebrow}</p>
            <h3>{supportingChromeTitle}</h3>
          </div>
          <span className="v2-chip v2-status-provenance">
            {t('v2Overview.wizardProgress', {
              step: displayedStep,
              total: PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
            })}
          </span>
        </div>

        <div className="v2-overview-summary-meta">
          {summaryMetaBlocks.map((block) => (
            <div key={block.label} className="v2-overview-meta-block">
              <span>{block.label}</span>
              <strong>{block.value}</strong>
            </div>
          ))}
        </div>

        {supportStatusItems.length > 0 ? (
          <div className="v2-overview-support-status-grid">
            {supportStatusItems.map((item) => (
              <article
                key={item.label}
                className="v2-overview-support-status-item"
                title={compactSupportingChrome ? item.detail : undefined}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                {!compactSupportingChrome ? <small>{item.detail}</small> : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="v2-overview-support-panel v2-overview-support-next">
        <div className="v2-overview-support-next-copy">
          <span className="v2-overview-eyebrow">
            {t('v2Overview.wizardCurrentFocus')}
          </span>
          <strong>{nextAction.title}</strong>
          <p>{nextAction.body}</p>
        </div>
      </div>
    </aside>
  );
};
