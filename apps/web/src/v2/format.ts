export function formatEur(value: number, digits = 0): string {
  return `${value.toLocaleString('fi-FI', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} EUR`;
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${value.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR/m3`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('fi-FI', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
