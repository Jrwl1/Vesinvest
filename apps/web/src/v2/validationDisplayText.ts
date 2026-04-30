import type { TFunction } from 'i18next';

import { resolveVesinvestReportGroupLabel } from './vesinvestLabels';

const LIVE_AUDIT_EVIDENCE_NOTE = 'Reviewed during live deployment audit.';
const LIVE_AUDIT_PROJECT_NOTE =
  'Plausible 20-year investment programme for audit flow.';
const BAD_ENCODING_PROJECT_NOTE =
  'Investeringsprogrammet har granskats f?r den aktiva planen.';
const BAD_ENCODING_TARIFF_EVIDENCE_NOTE =
  'Underlaget har granskats f?r den aktiva avgiftsplanen.';
const LIVE_AUDIT_RISK_NOTE =
  'Moderate risk; monitor affordability, liquidity, and staged implementation.';
const LIVE_AUDIT_PROJECT_NAME = 'Ledningsn\u00e4t saneering 2026-2030';

export function displayValidationProjectName(
  t: TFunction,
  value: string | null | undefined,
) {
  const text = value?.trim() ?? '';
  if (text === LIVE_AUDIT_PROJECT_NAME) {
    return t(
      'v2Vesinvest.validationProjectName',
      'Network rehabilitation 2026-2030',
    );
  }
  return value ?? '';
}

export function displayValidationProjectSubtype(
  t: TFunction,
  value: string | null | undefined,
) {
  const text = value?.trim() ?? '';
  if (text === 'network_rehabilitation' || text === 'N?tsanering') {
    return resolveVesinvestReportGroupLabel(t, 'network_rehabilitation', null);
  }
  return value ?? '';
}

export function displayValidationProjectNote(
  t: TFunction,
  value: string | null | undefined,
) {
  const text = value?.trim() ?? '';
  if (text === LIVE_AUDIT_PROJECT_NOTE || text === BAD_ENCODING_PROJECT_NOTE) {
    return t(
      'v2Vesinvest.validationProjectNote',
      'Investment programme reviewed for the active plan.',
    );
  }
  return value ?? '';
}

export function displayValidationAssetEvidenceNote(
  t: TFunction,
  value: string | null | undefined,
) {
  const text = value?.trim() ?? '';
  if (
    text === LIVE_AUDIT_EVIDENCE_NOTE ||
    text === LIVE_AUDIT_PROJECT_NOTE ||
    text === BAD_ENCODING_PROJECT_NOTE ||
    text === BAD_ENCODING_TARIFF_EVIDENCE_NOTE
  ) {
    return t(
      'v2Vesinvest.validationEvidenceNote',
      'Evidence reviewed for the active plan.',
    );
  }
  return value ?? '';
}

export function displayValidationTariffEvidenceNote(
  t: TFunction,
  value: string | null | undefined,
) {
  const text = value?.trim() ?? '';
  if (
    text === LIVE_AUDIT_EVIDENCE_NOTE ||
    text === BAD_ENCODING_TARIFF_EVIDENCE_NOTE
  ) {
    return t(
      'v2TariffPlan.validationEvidenceNote',
      'Evidence reviewed for the active tariff plan.',
    );
  }
  return value ?? '';
}

export function displayValidationTariffRiskNote(
  t: TFunction,
  value: string | null | undefined,
) {
  const text = value?.trim() ?? '';
  if (text === LIVE_AUDIT_RISK_NOTE) {
    return t(
      'v2TariffPlan.validationRiskNote',
      'Monitor affordability, liquidity, and staged implementation.',
    );
  }
  return value ?? '';
}
