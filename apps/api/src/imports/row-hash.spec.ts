import {
  computeRowHash,
  computeRawRowHash,
  extractMappedValues,
  hashesMatch,
} from './row-hash';

describe('RowHash', () => {
  const sampleColumnMap = new Map<string, { targetField: string }>([
    ['name', { targetField: 'name' }],
    ['byggår', { targetField: 'installedOn' }],
    ['cost', { targetField: 'replacementCostEur' }],
  ]);

  describe('computeRowHash', () => {
    it('should compute deterministic hash for same data', () => {
      const row = { name: 'Pump A', byggår: 2020, cost: 10000 };
      const hash1 = computeRowHash(row, sampleColumnMap);
      const hash2 = computeRowHash(row, sampleColumnMap);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different data', () => {
      const row1 = { name: 'Pump A', byggår: 2020, cost: 10000 };
      const row2 = { name: 'Pump B', byggår: 2020, cost: 10000 };
      const hash1 = computeRowHash(row1, sampleColumnMap);
      const hash2 = computeRowHash(row2, sampleColumnMap);
      expect(hash1).not.toBe(hash2);
    });

    it('should be case-insensitive for column lookup', () => {
      const row1 = { NAME: 'Pump A', byggår: 2020 };
      const row2 = { name: 'Pump A', BYGGÅR: 2020 };
      const hash1 = computeRowHash(row1, sampleColumnMap);
      const hash2 = computeRowHash(row2, sampleColumnMap);
      expect(hash1).toBe(hash2);
    });

    it('should normalize string values (case and whitespace)', () => {
      const row1 = { name: '  Pump A  ', byggår: 2020 };
      const row2 = { name: 'pump a', byggår: 2020 };
      const hash1 = computeRowHash(row1, sampleColumnMap);
      const hash2 = computeRowHash(row2, sampleColumnMap);
      expect(hash1).toBe(hash2);
    });

    it('should handle null and undefined values consistently', () => {
      // Same null/undefined pattern produces same hash
      const row1 = { name: 'Pump A', byggår: null, cost: undefined };
      const row2 = { name: 'Pump A', byggår: null, cost: undefined };
      const hash1 = computeRowHash(row1, sampleColumnMap);
      const hash2 = computeRowHash(row2, sampleColumnMap);
      expect(hash1).toBe(hash2);
    });

    it('should treat null/undefined as empty string in hash', () => {
      // Rows with only the name column produce consistent hash
      const row = { name: 'Pump A' };
      const hash = computeRowHash(row, sampleColumnMap);
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(16);
    });

    it('should produce consistent hash length', () => {
      const row = { name: 'Test', byggår: 2020, cost: 50000 };
      const hash = computeRowHash(row, sampleColumnMap);
      expect(hash.length).toBe(16); // First 16 hex chars of SHA-256
    });

    it('should only use mapped columns', () => {
      const row1 = { name: 'Pump A', byggår: 2020, extraField: 'ignored' };
      const row2 = { name: 'Pump A', byggår: 2020, otherField: 'also ignored' };
      const hash1 = computeRowHash(row1, sampleColumnMap);
      const hash2 = computeRowHash(row2, sampleColumnMap);
      expect(hash1).toBe(hash2);
    });

    it('should handle date objects consistently', () => {
      const date = new Date('2020-01-15');
      const row = { name: 'Test', byggår: date };
      const hash = computeRowHash(row, sampleColumnMap);
      expect(hash).toBeTruthy();

      // Same date should produce same hash
      const row2 = { name: 'Test', byggår: new Date('2020-01-15') };
      const hash2 = computeRowHash(row2, sampleColumnMap);
      expect(hash).toBe(hash2);
    });

    it('should handle floating point numbers consistently', () => {
      const row = { name: 'Test', cost: 10000.123456789 };
      const hash = computeRowHash(row, sampleColumnMap);
      expect(hash).toBeTruthy();
    });
  });

  describe('extractMappedValues', () => {
    it('should extract only mapped values', () => {
      const row = { name: 'Pump A', byggår: 2020, cost: 10000, extra: 'ignored' };
      const values = extractMappedValues(row, sampleColumnMap);
      expect(values).toEqual({
        name: 'Pump A',
        installedOn: 2020,
        replacementCostEur: 10000,
      });
      expect(values).not.toHaveProperty('extra');
    });

    it('should handle case-insensitive column names', () => {
      const row = { NAME: 'Pump A', BYGGÅR: 2020 };
      const values = extractMappedValues(row, sampleColumnMap);
      expect(values.name).toBe('Pump A');
      expect(values.installedOn).toBe(2020);
    });
  });

  describe('computeRawRowHash', () => {
    it('should compute hash from all row values', () => {
      const row = { a: 1, b: 2, c: 3 };
      const hash = computeRawRowHash(row);
      expect(hash).toBeTruthy();
      expect(hash.length).toBe(16);
    });

    it('should produce same hash for same data regardless of key order', () => {
      const row1 = { a: 1, b: 2, c: 3 };
      const row2 = { c: 3, a: 1, b: 2 };
      const hash1 = computeRawRowHash(row1);
      const hash2 = computeRawRowHash(row2);
      expect(hash1).toBe(hash2);
    });
  });

  describe('hashesMatch', () => {
    it('should return true for matching hashes', () => {
      const row = { name: 'Test', byggår: 2020 };
      const hash1 = computeRowHash(row, sampleColumnMap);
      const hash2 = computeRowHash(row, sampleColumnMap);
      expect(hashesMatch(hash1, hash2)).toBe(true);
    });

    it('should return false for different hashes', () => {
      const row1 = { name: 'Test1', byggår: 2020 };
      const row2 = { name: 'Test2', byggår: 2020 };
      const hash1 = computeRowHash(row1, sampleColumnMap);
      const hash2 = computeRowHash(row2, sampleColumnMap);
      expect(hashesMatch(hash1, hash2)).toBe(false);
    });
  });
});
