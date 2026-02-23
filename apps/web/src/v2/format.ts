import i18n from '../i18n';

type SupportedLanguage = 'fi' | 'sv' | 'en';

const LOCALE_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  fi: 'fi-FI',
  sv: 'sv-SE',
  en: 'en-US',
};

function resolveLanguage(value: string | undefined): SupportedLanguage {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  const base = normalized.split('-')[0];
  if (base === 'fi' || base === 'sv' || base === 'en') return base;
  return 'fi';
}

export function getActiveLocale(): string {
  const language = resolveLanguage(i18n.resolvedLanguage ?? i18n.language);
  return LOCALE_BY_LANGUAGE[language];
}

export function formatEur(value: number, digits = 0): string {
  return `${value.toLocaleString(getActiveLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} EUR`;
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${value.toLocaleString(getActiveLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR/m3`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString(getActiveLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString(getActiveLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
): string {
  if (value == null) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(getActiveLocale());
}
