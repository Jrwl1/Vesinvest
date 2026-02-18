/**
 * Formatting utilities for display
 */

const EMPTY_VALUE = '—';

const currencyFormatter = new Intl.NumberFormat('fi-FI', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Finnish locale decimal (comma as decimal separator). Use for Euro amounts with decimals. */
const decimalFormatter = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('fi-FI', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function parseNumericValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  return Number.isFinite(num) ? num : null;
}

/**
 * Format a number or string as EUR currency
 */
export function formatCurrency(value: string | number | null | undefined): string {
  const num = parseNumericValue(value);
  return num === null ? EMPTY_VALUE : currencyFormatter.format(num);
}

/** Canonical EUR formatter for whole-euro amounts (rounded). */
export function formatEurInt(value: string | number | null | undefined): string {
  const num = parseNumericValue(value);
  return num === null ? EMPTY_VALUE : currencyFormatter.format(Math.round(num));
}

/**
 * Format required tariff as €/m³ with 2 decimals, or "—" when infeasible.
 * Plan 5a: "Nödvändig taxa idag" -> X.XX €/m³ (2 decimals).
 */
export function formatTariffEurPerM3(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY_VALUE;
  return `${Number(value).toFixed(2)} €/m³`;
}

/** Canonical m³ formatter for integer volume displays. */
export function formatM3Int(value: string | number | null | undefined): string {
  const num = parseNumericValue(value);
  return num === null ? EMPTY_VALUE : `${Math.round(num).toLocaleString('fi-FI')} m³`;
}

/** Format a number with 2 decimals using Finnish locale (comma as decimal separator, e.g. 1 234,56). */
export function formatDecimal(value: string | number | null | undefined): string {
  const num = parseNumericValue(value);
  if (num === null) return '';
  return decimalFormatter.format(num);
}

/**
 * Format an ISO date string to localized date
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return EMPTY_VALUE;
  try {
    const date = new Date(isoString);
    return dateFormatter.format(date);
  } catch {
    return EMPTY_VALUE;
  }
}

/**
 * Extract year from ISO date string
 */
export function getYear(isoString: string | null | undefined): number | null {
  if (!isoString) return null;
  try {
    return new Date(isoString).getFullYear();
  } catch {
    return null;
  }
}

/**
 * Check if a year is within N years from now
 */
export function isWithinYears(year: number | null | undefined, years: number): boolean {
  if (year === null || year === undefined) return false;
  const currentYear = new Date().getFullYear();
  return year >= currentYear && year <= currentYear + years;
}

/**
 * Format status with proper casing
 */
export function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Human-readable label for import/schema field names (no raw schema in UI). */
export function humanizeFieldName(field: string): string {
  const map: Record<string, string> = {
    externalRef: 'ID',
    installedOn: 'Install year',
    lengthMeters: 'Length',
    lifeYears: 'Lifetime',
    replacementCostEur: 'Replacement cost',
    criticality: 'Criticality',
    name: 'Name',
    siteId: 'Location',
    notes: 'Notes',
  };
  return map[field] ?? field;
}
