import { describe, it, expect } from 'vitest';
import { formatCurrency, formatTariffEurPerM3 } from './format';

describe('format', () => {
  describe('formatCurrency', () => {
    it('formats whole euro (maximumFractionDigits: 0)', () => {
      const s = formatCurrency(12345.67);
      expect(s).toContain('€');
      expect(s).not.toMatch(/,\d/);
    });

    it('returns — for null/undefined/NaN', () => {
      expect(formatCurrency(null)).toBe('—');
      expect(formatCurrency(undefined)).toBe('—');
      expect(formatCurrency(NaN)).toBe('—');
    });
  });

  describe('formatTariffEurPerM3', () => {
    it('formats tariff with 2 decimals and €/m³', () => {
      expect(formatTariffEurPerM3(1.234)).toBe('1.23 €/m³');
      expect(formatTariffEurPerM3(0)).toBe('0.00 €/m³');
      expect(formatTariffEurPerM3(2.567)).toBe('2.57 €/m³');
    });

    it('returns — for null, undefined, or infeasible', () => {
      expect(formatTariffEurPerM3(null)).toBe('—');
      expect(formatTariffEurPerM3(undefined)).toBe('—');
      expect(formatTariffEurPerM3(NaN)).toBe('—');
    });
  });
});
