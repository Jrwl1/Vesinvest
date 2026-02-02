/**
 * Formatting utilities for display
 */

const currencyFormatter = new Intl.NumberFormat('fi-FI', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('fi-FI', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Format a number or string as EUR currency
 */
export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return currencyFormatter.format(num);
}

/**
 * Format an ISO date string to localized date
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return dateFormatter.format(date);
  } catch {
    return '—';
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
