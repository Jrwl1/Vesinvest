import type { TFunction } from 'i18next';

const LEGACY_SCENARIO_PREFIXES = ['Skenaario', 'Scenario'] as const;
const LEGACY_REPORT_PREFIXES = [
  'Ennusteraportti',
  'Forecast report',
  'Prognosrapport',
] as const;

function toIsoDateLabel(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value instanceof Date ? parsed.toISOString().slice(0, 10) : value;
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLegacyFiDateLabel(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getDate()}.${parsed.getMonth() + 1}.${parsed.getFullYear()}`;
}

function parseLegacyDateToken(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const fiDateMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!fiDateMatch) return null;

  const [, day, month, year] = fiDateMatch;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function buildDefaultScenarioName(
  t: TFunction,
  value: Date | string = new Date(),
): string {
  return `${t('v2Forecast.defaultScenarioPrefix', 'Scenario')} ${toIsoDateLabel(value)}`;
}

export function getScenarioDisplayName(
  name: string | null | undefined,
  t: TFunction,
): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return t('v2Forecast.defaultScenarioPrefix', 'Scenario');
  }

  const match = trimmed.match(/^(\S+)\s+(.+)$/);
  if (!match) return trimmed;

  const [, prefix, token] = match;
  if (!LEGACY_SCENARIO_PREFIXES.includes(prefix as (typeof LEGACY_SCENARIO_PREFIXES)[number])) {
    return trimmed;
  }

  const normalizedDate = parseLegacyDateToken(token);
  if (!normalizedDate) return trimmed;

  return `${t('v2Forecast.defaultScenarioPrefix', 'Scenario')} ${normalizedDate}`;
}

export function buildDefaultReportTitle(
  t: TFunction,
  scenarioName: string | null | undefined,
  value: Date | string = new Date(),
): string {
  const scenarioLabel = getScenarioDisplayName(scenarioName, t);
  const reportDate = toIsoDateLabel(value);
  const baseTitle = `${t('v2Reports.defaultTitlePrefix', 'Forecast report')} ${scenarioLabel}`;
  return scenarioLabel.endsWith(` ${reportDate}`)
    ? baseTitle
    : `${baseTitle} ${reportDate}`;
}

export function getReportDisplayTitle(params: {
  title: string | null | undefined;
  scenarioName: string | null | undefined;
  createdAt: string;
  t: TFunction;
}): string {
  const { title, scenarioName, createdAt, t } = params;
  const trimmed = title?.trim();
  if (!trimmed) {
    return buildDefaultReportTitle(t, scenarioName, createdAt);
  }

  const hasKnownPrefix = LEGACY_REPORT_PREFIXES.some((prefix) =>
    trimmed.startsWith(`${prefix} `),
  );
  if (!hasKnownPrefix) return trimmed;

  const createdIsoDate = toIsoDateLabel(createdAt);
  const createdLegacyFiDate = toLegacyFiDateLabel(createdAt);
  const looksLikeDefaultTitle =
    trimmed.endsWith(` ${createdIsoDate}`) ||
    (createdLegacyFiDate.length > 0 &&
      trimmed.endsWith(` ${createdLegacyFiDate}`));

  if (!looksLikeDefaultTitle) return trimmed;

  return buildDefaultReportTitle(t, scenarioName, createdAt);
}
