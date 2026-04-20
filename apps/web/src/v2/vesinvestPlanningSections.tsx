import React from 'react';
import type { TFunction } from 'i18next';

export const VesinvestRevisionSurface: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => <>{children}</>;

export const VesinvestIdentitySurface: React.FC<{
  t: TFunction;
  badge: React.ReactNode;
  children: React.ReactNode;
}> = ({ t, badge, children }) => (
  <section className="v2-vesinvest-section">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Vesinvest.identityLock', 'Identity guardrail')}
        </p>
        <h3>{t('v2Vesinvest.utilityName', 'Utility name')}</h3>
      </div>
      {badge}
    </div>
    {children}
  </section>
);

export const VesinvestDepreciationPlanSurface: React.FC<{
  t: TFunction;
  children: React.ReactNode;
}> = ({ t, children }) => (
  <section className="v2-vesinvest-section">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Vesinvest.depreciationPlan', 'Depreciation plan')}
        </p>
        <h3>{t('v2Vesinvest.classPlanHeading', 'Class-owned depreciation plan')}</h3>
      </div>
    </div>
    {children}
  </section>
);

export const VesinvestBaselineReviewSurface: React.FC<{
  t: TFunction;
  badge: React.ReactNode;
  statusStrip?: React.ReactNode;
  feePath: React.ReactNode;
  children: React.ReactNode;
}> = ({ t, badge, statusStrip, feePath, children }) => (
  <>
    {statusStrip ?? null}
    <section className="v2-vesinvest-section">
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">
            {t('v2Vesinvest.evidenceEyebrow', 'Baseline & evidence')}
          </p>
          <h3>{t('v2Vesinvest.evidenceTitle', 'Accepted baseline years')}</h3>
        </div>
        {badge}
      </div>
      {children}
    </section>
    {feePath}
  </>
);

export const VesinvestMatrixSurface: React.FC<{
  t: TFunction;
  children: React.ReactNode;
}> = ({ t, children }) => (
  <section className="v2-vesinvest-section">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Vesinvest.investmentPlan', 'Investment plan')}
        </p>
        <h3>{t('v2Vesinvest.groupedLayout', 'Grouped horizon layout')}</h3>
      </div>
    </div>
    {children}
  </section>
);

export const VesinvestRegisterSurface: React.FC<{
  t: TFunction;
  children: React.ReactNode;
}> = ({ t, children }) => (
  <section className="v2-vesinvest-section">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Vesinvest.projectRegister', 'Project register')}
        </p>
        <h3>{t('v2Vesinvest.editableProjects', 'Editable project rows')}</h3>
      </div>
    </div>
    {children}
  </section>
);

export const VesinvestProjectDetailsSurface: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="v2-vesinvest-project-details">{children}</div>
);
