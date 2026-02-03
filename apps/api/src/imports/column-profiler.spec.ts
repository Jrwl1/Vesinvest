import {
  profileColumn,
  profileColumns,
  normalizeHeader,
  ColumnProfile,
  InferredColumnType,
} from './column-profiler';

describe('ColumnProfiler', () => {
  describe('normalizeHeader', () => {
    it('should lowercase and trim headers', () => {
      expect(normalizeHeader('  Name  ')).toBe('name');
      expect(normalizeHeader('ASSET NAME')).toBe('asset name');
    });

    it('should normalize whitespace', () => {
      expect(normalizeHeader('asset  name')).toBe('asset name');
      expect(normalizeHeader('asset_name')).toBe('asset name');
      expect(normalizeHeader('asset-name')).toBe('asset name');
    });

    it('should remove parentheses and brackets', () => {
      expect(normalizeHeader('Length (m)')).toBe('length m');
      expect(normalizeHeader('Cost [EUR]')).toBe('cost eur');
    });
  });

  describe('profileColumn', () => {
    it('should detect string columns', () => {
      const values = ['Hello', 'World', 'Test'];
      const profile = profileColumn('Name', 0, values);
      expect(profile.inferredType).toBe('string');
      expect(profile.emptyRate).toBe(0);
      expect(profile.nonEmptyCount).toBe(3);
    });

    it('should detect number columns', () => {
      const values = [100, 200, 300];
      const profile = profileColumn('Cost', 0, values);
      expect(profile.inferredType).toBe('number');
    });

    it('should detect date columns from ISO strings', () => {
      const values = ['2020-01-15', '2021-06-20', '2022-12-01'];
      const profile = profileColumn('Date', 0, values);
      expect(profile.inferredType).toBe('date');
    });

    it('should detect date columns from year strings', () => {
      const values = ['2020', '2021', '2019'];
      const profile = profileColumn('Year', 0, values);
      expect(profile.inferredType).toBe('date');
    });

    it('should detect boolean columns', () => {
      const values = ['true', 'false', 'yes'];
      const profile = profileColumn('Active', 0, values);
      expect(profile.inferredType).toBe('boolean');
    });

    it('should calculate empty rate correctly', () => {
      const values = ['A', null, 'B', '', undefined];
      const profile = profileColumn('Test', 0, values);
      expect(profile.emptyRate).toBe(60); // 3 out of 5 are empty
      expect(profile.nonEmptyCount).toBe(2);
      expect(profile.totalCount).toBe(5);
    });

    it('should detect mixed type columns', () => {
      const values = ['Hello', 100, new Date(), true];
      const profile = profileColumn('Mixed', 0, values);
      expect(profile.inferredType).toBe('mixed');
    });

    it('should detect empty columns', () => {
      const values = [null, undefined, ''];
      const profile = profileColumn('Empty', 0, values);
      expect(profile.inferredType).toBe('empty');
      expect(profile.emptyRate).toBe(100);
    });

    it('should collect example values', () => {
      const values = ['A', 'B', 'C', 'D', 'E', 'F'];
      const profile = profileColumn('Test', 0, values);
      expect(profile.exampleValues.length).toBeLessThanOrEqual(5);
      expect(profile.exampleValues).toContain('A');
    });

    it('should detect units from header', () => {
      const profile1 = profileColumn('Length (m)', 0, [1, 2, 3]);
      expect(profile1.detectedUnits).toContain('m');

      const profile2 = profileColumn('Cost (EUR)', 0, [100]);
      expect(profile2.detectedUnits).toContain('€');

      const profile3 = profileColumn('Life Years', 0, [10]);
      expect(profile3.detectedUnits).toContain('years');
    });

    it('should normalize header', () => {
      const profile = profileColumn('  Asset Name  ', 0, ['Test']);
      expect(profile.headerRaw).toBe('  Asset Name  ');
      expect(profile.headerNormalized).toBe('asset name');
    });

    it('should handle numeric strings', () => {
      const values = ['100', '200', '300'];
      const profile = profileColumn('Count', 0, values);
      expect(profile.inferredType).toBe('number');
    });

    it('should handle currency values as numbers', () => {
      const values = ['€100', '$200', '300.50'];
      const profile = profileColumn('Cost', 0, values);
      expect(profile.inferredType).toBe('number');
    });
  });

  describe('profileColumns', () => {
    it('should profile all columns', () => {
      const headers = ['Name', 'Year', 'Cost'];
      const sampleRows = [
        { Name: 'Asset A', Year: 2020, Cost: 1000 },
        { Name: 'Asset B', Year: 2021, Cost: 2000 },
      ];

      const profiles = profileColumns(headers, sampleRows);
      expect(profiles.length).toBe(3);
      expect(profiles[0].headerRaw).toBe('Name');
      expect(profiles[1].headerRaw).toBe('Year');
      expect(profiles[2].headerRaw).toBe('Cost');
    });

    it('should handle case-insensitive column lookup', () => {
      const headers = ['NAME'];
      const sampleRows = [{ name: 'Test1' }, { NAME: 'Test2' }];

      const profiles = profileColumns(headers, sampleRows);
      expect(profiles[0].nonEmptyCount).toBe(2);
    });

    it('should handle missing columns in rows', () => {
      const headers = ['Name', 'Optional'];
      const sampleRows = [{ Name: 'Test1' }, { Name: 'Test2' }];

      const profiles = profileColumns(headers, sampleRows);
      expect(profiles[0].nonEmptyCount).toBe(2);
      expect(profiles[1].nonEmptyCount).toBe(0);
      expect(profiles[1].emptyRate).toBe(100);
    });
  });
});
