import type { TFunction } from 'i18next';
import React from 'react';

import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { applyManualLanguagePreference } from '../i18n';
import {
  TABS,
  preloadTab,
  type OrgLanguageNotice,
  type TabId,
  type TabStatus,
} from './appShellV2Routing';

export function AppShellV2Header({
  t,
  activeTab,
  tabLabels,
  tabStatuses,
  shellBackLabel,
  onBack,
  pageIndicatorCaption,
  pageIndicatorLabel,
  isTabLocked,
  lockedTabMessage,
  handleTabChange,
  drawerOpen,
  setDrawerOpen,
  connectionChipToneClass,
  connectionChipLabel,
  orgChipLabel,
  orgChipName,
}: {
  t: TFunction;
  activeTab: TabId;
  tabLabels: Record<TabId, string>;
  tabStatuses: Record<TabId, TabStatus>;
  shellBackLabel: string | null;
  onBack: () => void;
  pageIndicatorCaption: string;
  pageIndicatorLabel: string;
  isTabLocked: (tab: TabId) => boolean;
  lockedTabMessage: (tab: TabId) => string;
  handleTabChange: (tab: TabId) => void;
  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  connectionChipToneClass: string;
  connectionChipLabel: string;
  orgChipLabel: string;
  orgChipName: string | null;
}) {
  const workflowLabels: Record<TabId, string> = {
    overview: t('v2Shell.workflowBaseline', 'Baseline'),
    asset_management: t('v2Shell.workflowAssetPlan', 'Asset plan'),
    ennuste: t('v2Shell.workflowForecast', 'Forecast'),
    tariff_plan: t('v2Shell.workflowTariffPlan', 'Tariff plan'),
    reports: t('v2Shell.workflowReports', 'Reports'),
  };

  return (
    <header className="v2-app-header">
      <div className="v2-app-header-inner">
        <div className="v2-brand-block">
          <div className="v2-brand">
            <span className="v2-brand-title">{t('app.title', 'Vesinvest')}</span>
            <span className="v2-brand-subtitle">{t('v2Shell.subtitle', 'Financial planning')}</span>
          </div>
          <div className="v2-brand-meta">
            {shellBackLabel ? (
              <button type="button" className="v2-shell-back-btn" onClick={onBack}>
                {shellBackLabel}
              </button>
            ) : null}
            <div className="v2-page-indicator" aria-live="polite">
              <span>{pageIndicatorCaption}</span>
              <strong>{pageIndicatorLabel}</strong>
            </div>
          </div>
        </div>

        <nav className="v2-main-nav" aria-label={t('v2Shell.mainNavigation', 'Main navigation')}>
          {TABS.map((tab) => {
            const locked = isTabLocked(tab);
            const status = tabStatuses[tab];
            const statusTitle = `${tabLabels[tab]}: ${status.label}`;
            const statusDescriptionId = `v2-tab-status-${tab}`;
            const buttonTitle = locked
              ? `${lockedTabMessage(tab)} ${statusTitle}`
              : statusTitle;
            return (
              <button
                key={tab}
                type="button"
                className={`v2-nav-btn ${activeTab === tab ? 'active' : ''} v2-nav-status-${status.tone}`}
                onClick={() => handleTabChange(tab)}
                onMouseEnter={() => preloadTab(tab)}
                aria-current={activeTab === tab ? 'page' : undefined}
                aria-disabled={locked || undefined}
                aria-label={tabLabels[tab]}
                aria-describedby={statusDescriptionId}
                title={buttonTitle}
              >
                <span
                  className="v2-nav-status-dot"
                  aria-hidden="true"
                />
                <span className="v2-nav-label">{tabLabels[tab]}</span>
                <span className="v2-nav-status-label" aria-hidden="true">
                  {status.label}
                </span>
                <span id={statusDescriptionId} className="v2-sr-only">
                  {statusTitle}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="v2-header-tools">
          <LanguageSwitcher />
          <button
            type="button"
            className="v2-account-btn"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-expanded={drawerOpen}
            aria-controls="v2-account-drawer"
          >
            {t('v2Shell.accountButton', 'Account')}
          </button>
        </div>
      </div>
      <div className="v2-header-meta">
        <div
          className="v2-workflow-strip"
          aria-label={t('v2Shell.workflowStrip', 'Workflow status')}
        >
          {TABS.map((tab) => {
            const status = tabStatuses[tab];
            return (
              <button
                key={tab}
                type="button"
                className={`v2-workflow-step ${activeTab === tab ? 'active' : ''} v2-workflow-step-${status.tone}`}
                onClick={() => handleTabChange(tab)}
                onMouseEnter={() => preloadTab(tab)}
                aria-current={activeTab === tab ? 'step' : undefined}
                aria-disabled={isTabLocked(tab) || undefined}
                title={`${workflowLabels[tab]}: ${status.label}`}
              >
                <span>{workflowLabels[tab]}</span>
                <strong>{status.label}</strong>
              </button>
            );
          })}
        </div>
        <div className="v2-header-statuses">
          <span className={`v2-badge ${connectionChipToneClass}`}>{connectionChipLabel}</span>
          <span className="v2-badge v2-status-provenance v2-org-chip">
            <span>{t('v2Shell.workspaceLabel', 'Workspace')}</span>
            <strong className="v2-org-chip-value" title={orgChipLabel}>
              <span className="v2-org-chip-name">{orgChipName}</span>
            </strong>
          </span>
        </div>
      </div>
    </header>
  );
}

export function AppShellV2LanguageNotice({
  t,
  orgLanguageNotice,
  clearOrgLanguageNotice,
}: {
  t: TFunction;
  orgLanguageNotice: OrgLanguageNotice | null;
  clearOrgLanguageNotice: () => void;
}) {
  if (!orgLanguageNotice) {
    return null;
  }

  return (
    <div className="v2-language-notice" role="status" aria-live="polite">
      <p>
        {orgLanguageNotice.kind === 'switched'
          ? t(
              'v2Shell.orgLanguageSwitched',
              'Organization language is {{language}}. The workspace switched automatically.',
              {
                language: t(`language.${orgLanguageNotice.language}`, orgLanguageNotice.language),
              },
            )
          : t(
              'v2Shell.orgLanguageKept',
              'Organization language is {{language}}. Keeping your chosen interface language.',
              {
                language: t(`language.${orgLanguageNotice.language}`, orgLanguageNotice.language),
              },
            )}
      </p>
      <div className="v2-language-notice-actions">
        {orgLanguageNotice.kind === 'switched' ? (
          <button
            type="button"
            className="v2-btn v2-btn-small"
            onClick={() => {
              void applyManualLanguagePreference(orgLanguageNotice.previousLanguage);
              clearOrgLanguageNotice();
            }}
          >
            {t('v2Shell.orgLanguageUndo', 'Keep {{language}}', {
              language: t(
                `language.${orgLanguageNotice.previousLanguage}`,
                orgLanguageNotice.previousLanguage,
              ),
            })}
          </button>
        ) : null}
        <button type="button" className="v2-btn v2-btn-small" onClick={clearOrgLanguageNotice}>
          {t('common.close', 'Close')}
        </button>
      </div>
    </div>
  );
}

export function AppShellV2BlockedTabNotice({
  t,
  blockedTabNotice,
  tabLabels,
  lockedTabMessage,
  showBlockedTabRecoveryAction,
  handleLockedTabRecovery,
  lockedTabActionLabel,
  clearBlockedTabNotice,
}: {
  t: TFunction;
  blockedTabNotice: TabId | null;
  tabLabels: Record<TabId, string>;
  lockedTabMessage: (tab: TabId) => string;
  showBlockedTabRecoveryAction: boolean;
  handleLockedTabRecovery: () => void;
  lockedTabActionLabel: (tab: TabId) => string;
  clearBlockedTabNotice: () => void;
}) {
  if (!blockedTabNotice) {
    return null;
  }

  return (
    <div className="v2-language-notice v2-shell-tab-notice" role="status" aria-live="polite">
      <p>
        <strong>{tabLabels[blockedTabNotice]}</strong>
        {': '}
        {lockedTabMessage(blockedTabNotice)}
      </p>
      <div className="v2-language-notice-actions">
        {showBlockedTabRecoveryAction ? (
          <button
            type="button"
            className="v2-btn v2-btn-small v2-btn-primary"
            onClick={handleLockedTabRecovery}
          >
            {lockedTabActionLabel(blockedTabNotice)}
          </button>
        ) : null}
        <button type="button" className="v2-btn v2-btn-small" onClick={clearBlockedTabNotice}>
          {t('common.close', 'Close')}
        </button>
      </div>
    </div>
  );
}

export function AppShellV2AccountDrawer({
  t,
  drawerOpen,
  closeDrawer,
  orgChipLabel,
  roleText,
  activeTabLabel,
  isAdmin,
  clearBusy,
  clearError,
  clearConfirmValue,
  setClearConfirmValue,
  clearConfirmMatches,
  clearConfirmToken,
  handleClearImportAndScenarios,
  isDemoMode,
  onLogout,
}: {
  t: TFunction;
  drawerOpen: boolean;
  closeDrawer: () => void;
  orgChipLabel: string;
  roleText: string;
  activeTabLabel: string;
  isAdmin: boolean;
  clearBusy: boolean;
  clearError: string | null;
  clearConfirmValue: string;
  setClearConfirmValue: React.Dispatch<React.SetStateAction<string>>;
  clearConfirmMatches: boolean;
  clearConfirmToken: string;
  handleClearImportAndScenarios: () => Promise<void>;
  isDemoMode: boolean;
  onLogout: () => void;
}) {
  if (!drawerOpen) {
    return null;
  }

  return (
    <div className="v2-account-drawer-layer" onClick={closeDrawer}>
      <aside
        id="v2-account-drawer"
        className="v2-account-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('v2Shell.accountTitle', 'Account and access')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="v2-account-drawer-head">
          <div>
            <span className="v2-overview-eyebrow">{t('v2Shell.accountButton', 'Account')}</span>
            <h3>{t('v2Shell.accountTitle', 'Account and access')}</h3>
            <p className="v2-muted">
              {t('v2Shell.drawerHint', 'Workspace access and organization controls.')}
            </p>
          </div>
          <button
            type="button"
            className="v2-account-drawer-close"
            onClick={closeDrawer}
            aria-label={t('common.close', 'Close')}
          >
            x
          </button>
        </div>

        <div className="v2-account-drawer-section">
          <p>
            <strong>{t('v2Shell.orgLabel', 'Org')}:</strong> {orgChipLabel}
          </p>
          <p>
            <strong>{t('v2Shell.roleLabel', 'Role')}:</strong> {roleText}
          </p>
          <p>
            <strong>{t('v2Shell.activeWorkspace', 'Active workspace')}:</strong> {activeTabLabel}
          </p>
        </div>

        <div className="v2-account-drawer-section">
          <p className="v2-muted">
            {t(
              'v2Shell.legalHint',
              'Legal acceptance and trial logic follow current backend behavior.',
            )}
          </p>
          {isAdmin ? (
            <>
              <p className="v2-muted">
                {t(
                  'v2Shell.clearDataHint',
                  'Admin tool: clears VEETI imports, Vesinvest plans, and forecast scenarios for this org.',
                )}
              </p>
              <p className="v2-muted">
                {t(
                  'v2Shell.clearDataTypeHint',
                  'For safety, type {{token}} before the database clear action becomes available.',
                  { token: clearConfirmToken },
                )}
              </p>
              <label className="v2-field v2-danger-field">
                <span>{t('v2Shell.clearDataCodeLabel', 'Confirmation code')}</span>
                <input
                  type="text"
                  className="v2-input"
                  value={clearConfirmValue}
                  onChange={(event) => setClearConfirmValue(event.target.value)}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-describedby="v2-clear-data-help"
                />
              </label>
              <p id="v2-clear-data-help" className="v2-muted">
                {clearConfirmMatches
                  ? t(
                      'v2Shell.clearDataTypeMatched',
                      'Confirmation code matches. Database clear is enabled.',
                    )
                  : t('v2Shell.clearDataTypePrompt', 'Type {{token}} to confirm database clear.', {
                      token: clearConfirmToken,
                    })}
              </p>
              <button
                type="button"
                className="v2-btn v2-btn-danger"
                onClick={() => void handleClearImportAndScenarios()}
                disabled={clearBusy || !clearConfirmMatches}
              >
                {clearBusy
                  ? t('v2Shell.clearDataBusy', 'Clearing...')
                  : t('v2Shell.clearDataButton', 'Clear database')}
              </button>
            </>
          ) : null}
          {clearError ? <div className="v2-alert v2-alert-error">{clearError}</div> : null}
        </div>

        {!isDemoMode ? (
          <div className="v2-account-drawer-actions">
            <button
              type="button"
              className="v2-btn v2-btn-danger"
              onClick={onLogout}
              disabled={clearBusy}
            >
              {t('auth.signOut', 'Sign out')}
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
