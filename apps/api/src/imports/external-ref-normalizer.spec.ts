import {
  normalizeExternalRef,
  normalizeExternalRefWithDetails,
  isValidExternalRef,
  analyzeExternalRefColumn,
} from './external-ref-normalizer';

describe('External Ref Normalizer', () => {
  describe('normalizeExternalRef', () => {
    it('should convert numbers to strings', () => {
      expect(normalizeExternalRef(12345)).toBe('12345');
      expect(normalizeExternalRef(0)).toBe('0');
      expect(normalizeExternalRef(-1)).toBe('-1');
      expect(normalizeExternalRef(3.14159)).toBe('3.14159');
    });

    it('should handle GIS-style large numeric IDs', () => {
      // Common in FEATUREID, OBJECTID columns
      expect(normalizeExternalRef(1234567890123)).toBe('1234567890123');
      expect(normalizeExternalRef(987654321)).toBe('987654321');
    });

    it('should trim whitespace from strings', () => {
      expect(normalizeExternalRef('  ABC123  ')).toBe('ABC123');
      expect(normalizeExternalRef('\tID-001\n')).toBe('ID-001');
      expect(normalizeExternalRef('   ')).toBeNull();
    });

    it('should return null for empty values', () => {
      expect(normalizeExternalRef('')).toBeNull();
      expect(normalizeExternalRef('   ')).toBeNull();
      expect(normalizeExternalRef(null)).toBeNull();
      expect(normalizeExternalRef(undefined)).toBeNull();
    });

    it('should reject NaN and Infinity', () => {
      expect(normalizeExternalRef(NaN)).toBeNull();
      expect(normalizeExternalRef(Infinity)).toBeNull();
      expect(normalizeExternalRef(-Infinity)).toBeNull();
    });

    it('should preserve valid strings as-is', () => {
      expect(normalizeExternalRef('PIPE-001')).toBe('PIPE-001');
      expect(normalizeExternalRef('abc_123_def')).toBe('abc_123_def');
      expect(normalizeExternalRef('GIS-2024-00001')).toBe('GIS-2024-00001');
    });

    it('should handle numeric strings without double conversion', () => {
      expect(normalizeExternalRef('12345')).toBe('12345');
      expect(normalizeExternalRef('  12345  ')).toBe('12345');
    });
  });

  describe('normalizeExternalRefWithDetails', () => {
    it('should report when normalization occurred', () => {
      const result = normalizeExternalRefWithDetails(12345);
      expect(result.value).toBe('12345');
      expect(result.wasNormalized).toBe(true);
      expect(result.originalType).toBe('number');
    });

    it('should not report normalization for clean strings', () => {
      const result = normalizeExternalRefWithDetails('ABC123');
      expect(result.value).toBe('ABC123');
      expect(result.wasNormalized).toBe(false);
      expect(result.originalType).toBe('string');
    });

    it('should report normalization for trimmed strings', () => {
      const result = normalizeExternalRefWithDetails('  ABC123  ');
      expect(result.value).toBe('ABC123');
      expect(result.wasNormalized).toBe(true);
      expect(result.originalType).toBe('string');
    });

    it('should provide invalid reason for null values', () => {
      const result = normalizeExternalRefWithDetails(null);
      expect(result.value).toBeNull();
      expect(result.invalidReason).toBe('Value is null');
      expect(result.originalType).toBe('null');
    });

    it('should provide invalid reason for empty strings', () => {
      const result = normalizeExternalRefWithDetails('');
      expect(result.value).toBeNull();
      expect(result.invalidReason).toBe('String is empty after trimming');
      expect(result.originalType).toBe('string');
    });
  });

  describe('isValidExternalRef', () => {
    it('should return true for valid values', () => {
      expect(isValidExternalRef('ABC123')).toBe(true);
      expect(isValidExternalRef(12345)).toBe(true);
      expect(isValidExternalRef(0)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isValidExternalRef(null)).toBe(false);
      expect(isValidExternalRef(undefined)).toBe(false);
      expect(isValidExternalRef('')).toBe(false);
      expect(isValidExternalRef('   ')).toBe(false);
      expect(isValidExternalRef(NaN)).toBe(false);
    });
  });

  describe('analyzeExternalRefColumn', () => {
    it('should count numeric and string values correctly', () => {
      const values = [12345, 'ABC', 67890, 'DEF', null, ''];
      const analysis = analyzeExternalRefColumn(values);

      expect(analysis.validCount).toBe(4);
      expect(analysis.numericCount).toBe(2);
      expect(analysis.stringCount).toBe(2);
      expect(analysis.invalidCount).toBe(2);
      expect(analysis.emptyCount).toBe(2);
      expect(analysis.invalidIndices).toEqual([4, 5]);
    });

    it('should handle all-numeric column (GIS export)', () => {
      const values = [1001, 1002, 1003, 1004, 1005];
      const analysis = analyzeExternalRefColumn(values);

      expect(analysis.validCount).toBe(5);
      expect(analysis.numericCount).toBe(5);
      expect(analysis.stringCount).toBe(0);
      expect(analysis.invalidCount).toBe(0);
    });

    it('should handle mixed column with gaps', () => {
      const values = ['ID-001', null, 12345, '', 'ID-002', undefined];
      const analysis = analyzeExternalRefColumn(values);

      expect(analysis.validCount).toBe(3);
      expect(analysis.invalidCount).toBe(3);
      expect(analysis.emptyCount).toBe(3);
    });
  });

  describe('idempotency', () => {
    it('should produce stable results when normalized multiple times', () => {
      const original = 12345;
      const first = normalizeExternalRef(original);
      const second = normalizeExternalRef(first);

      expect(first).toBe('12345');
      expect(second).toBe('12345');
      expect(first).toBe(second);
    });

    it('should produce identical hash inputs from numeric and string versions', () => {
      // This is critical for idempotent imports
      const fromNumber = normalizeExternalRef(12345);
      const fromString = normalizeExternalRef('12345');
      const fromPaddedString = normalizeExternalRef('  12345  ');

      expect(fromNumber).toBe(fromString);
      expect(fromString).toBe(fromPaddedString);
    });
  });

  describe('real-world GIS data patterns', () => {
    it('should handle UWD_LINEFEATUREID style IDs', () => {
      // Typical GIS export - numeric feature IDs
      const featureIds = [
        1234567890,
        2345678901,
        3456789012,
        4567890123,
      ];

      for (const id of featureIds) {
        const normalized = normalizeExternalRef(id);
        expect(normalized).toBe(String(id));
        expect(typeof normalized).toBe('string');
      }
    });

    it('should handle mixed GIS/manual data', () => {
      // Some rows from GIS (numeric), some manually entered (string)
      const mixedData = [
        { raw: 1001, expected: '1001' },
        { raw: 'PUMP-001', expected: 'PUMP-001' },
        { raw: 1002, expected: '1002' },
        { raw: 'VALVE-ABC', expected: 'VALVE-ABC' },
        { raw: '  1003  ', expected: '1003' },
      ];

      for (const { raw, expected } of mixedData) {
        expect(normalizeExternalRef(raw)).toBe(expected);
      }
    });
  });
});
