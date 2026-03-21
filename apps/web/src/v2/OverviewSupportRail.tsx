import React from 'react';
import type { TFunction } from 'i18next';

type SummaryMetaBlock = {
  label: string;
  value: string;
};

type SummaryItem = {
  label: string;
  value: string;
  detail: string;
};

type SupportHelper = {
  key: string;
  label: string;
  title: string;
  body: string;
  tone: 'neutral' | 'positive' | 'warning';
};

type WizardHero = {
  title: string;
  body: string;
};

type Props = {
  t: TFunction;
  wizardDisplayStep: number;
  isStep2SupportChrome: boolean;
  compactSupportingChrome: boolean;
  supportingChromeEyebrow: string;
  supportingChromeTitle: string;
  wizardHero: WizardHero;
  summaryMetaBlocks: readonly SummaryMetaBlock[];
  wizardSummaryItems: readonly SummaryItem[];
  wizardContextHelpers: readonly SupportHelper[];
};

export const OverviewSupportRail: React.FC<Props> = ({
  t,
  wizardDisplayStep,
  isStep2SupportChrome,
  compactSupportingChrome,
  supportingChromeEyebrow,
  supportingChromeTitle,
  wizardHero,
  summaryMetaBlocks,
  wizardSummaryItems,
  wizardContextHelpers,
}) => (
  <section
    className={`v2-overview-hero-grid ${isStep2SupportChrome ? 'step2-support' : ''}`}
  >
    <article
      className={`v2-card v2-overview-summary-card v2-overview-wizard-card ${
        compactSupportingChrome ? 'compact' : ''
      } ${isStep2SupportChrome ? 'v2-overview-step2-support-card' : ''}`}
    >
      <div className="v2-overview-summary-head">
        <div>
          <p className="v2-overview-eyebrow">{supportingChromeEyebrow}</p>
          <h2>{supportingChromeTitle}</h2>
        </div>
        <span className="v2-chip v2-status-info">
          {t('v2Overview.wizardProgress', { step: wizardDisplayStep })}
        </span>
      </div>

      {!compactSupportingChrome ? (
        <p className="v2-muted v2-overview-summary-body">{wizardHero.body}</p>
      ) : null}

      <div className="v2-overview-summary-meta">
        {summaryMetaBlocks.map((block) => (
          <div key={block.label} className="v2-overview-meta-block">
            <span>{block.label}</span>
            <strong>{block.value}</strong>
          </div>
        ))}
      </div>
    </article>

    <aside
      className={`v2-card v2-overview-progress-card ${
        compactSupportingChrome ? 'compact' : ''
      } ${isStep2SupportChrome ? 'step2-support' : ''}`}
    >
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">
            {t('v2Overview.wizardSummaryTitle')}
          </p>
          <h3>
            {isStep2SupportChrome
              ? t('v2Overview.wizardContextImportedWorkspaceYears')
              : t('v2Overview.wizardSummarySubtitle')}
          </h3>
        </div>
        <span className="v2-chip v2-status-provenance">
          {t('v2Overview.wizardProgress', { step: wizardDisplayStep })}
        </span>
      </div>

      <div className="v2-overview-progress-list">
        {wizardSummaryItems.map((item) => (
          <article key={item.label} className="v2-overview-progress-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>

      {wizardContextHelpers.length > 0 ? (
        <div
          className={`v2-overview-helper-list ${
            isStep2SupportChrome ? 'step2-support' : ''
          }`}
        >
          {wizardContextHelpers.map((helper) => (
            <article
              key={helper.key}
              className={`v2-overview-helper-card v2-overview-helper-card-${helper.tone}`}
            >
              <div className="v2-overview-helper-head">
                <span>{helper.label}</span>
                <strong>{helper.title}</strong>
              </div>
              <p>{helper.body}</p>
            </article>
          ))}
        </div>
      ) : null}
    </aside>
  </section>
);
