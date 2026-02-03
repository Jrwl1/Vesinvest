/**
 * Tests for Data Row Detector and Site Value Sanitization
 * 
 * These tests ensure:
 * 1. Header/descriptor rows are correctly skipped
 * 2. Site values like "Area", "Ägare" are filtered out
 * 3. Real data rows are correctly identified
 */

import {
  detectDataStartRow,
  sanitizeSiteValues,
  isValidSiteValue,
  getDataRows,
} from './data-row-detector';

describe('Data Row Detector', () => {
  describe('detectDataStartRow', () => {
    const headers = ['Ägare', 'Ledningstyp', 'Mätmått', 'Area', 'Subarea', 'ObjectID', 'Name'];

    it('should detect first row as data when it contains IDs and values', () => {
      const rows = [
        { Ägare: 'Kommunen', Ledningstyp: 'Vatten', Area: 'Centrum', ObjectID: 12345, Name: 'Ledning A' },
        { Ägare: 'Privat', Ledningstyp: 'Avlopp', Area: 'Norr', ObjectID: 12346, Name: 'Ledning B' },
      ];

      const result = detectDataStartRow(rows, headers, 'ObjectID');
      expect(result.dataStartIndex).toBe(0);
      expect(result.skippedRows).toBe(0);
    });

    it('should skip descriptor row containing Swedish labels', () => {
      // This mimics the problematic Swedish Excel format where first data row
      // contains labels like "Ägare", "Ledningstyp", "Area"
      const rows = [
        { Ägare: 'Ägare', Ledningstyp: 'Ledningstyp', Area: 'Area', ObjectID: 'ObjectID', Name: 'Namn' },
        { Ägare: 'Kommunen', Ledningstyp: 'Vatten', Area: 'Centrum', ObjectID: 12345, Name: 'Ledning A' },
        { Ägare: 'Privat', Ledningstyp: 'Avlopp', Area: 'Norr', ObjectID: 12346, Name: 'Ledning B' },
      ];

      const result = detectDataStartRow(rows, headers, 'ObjectID');
      expect(result.dataStartIndex).toBe(1);
      expect(result.skippedRows).toBe(1);
    });

    it('should skip multiple header/descriptor rows', () => {
      const rows = [
        { Ägare: 'Owner', Ledningstyp: 'Type', Area: 'Area', ObjectID: 'ID', Name: 'Name' },
        { Ägare: 'Ägare', Ledningstyp: 'Ledningstyp', Area: 'Area', ObjectID: 'ObjectID', Name: 'Namn' },
        { Ägare: 'Kommunen', Ledningstyp: 'Vatten', Area: 'Centrum', ObjectID: 12345, Name: 'Ledning A' },
      ];

      const result = detectDataStartRow(rows, headers, 'ObjectID');
      expect(result.dataStartIndex).toBe(2);
      expect(result.skippedRows).toBe(2);
    });

    it('should handle empty rows array', () => {
      const result = detectDataStartRow([], headers);
      expect(result.dataStartIndex).toBe(0);
      expect(result.skippedRows).toBe(0);
    });

    it('should detect data row even without numeric externalRef when other values are data-like', () => {
      const rows = [
        { Ägare: 'Kommunen', Ledningstyp: 'Vatten', Area: 'Centrum', ObjectID: 'VA-001', Name: 'Ledning A' },
      ];

      const result = detectDataStartRow(rows, headers, 'ObjectID');
      expect(result.dataStartIndex).toBe(0);
    });
  });

  describe('sanitizeSiteValues', () => {
    const headers = ['Ägare', 'Ledningstyp', 'Mätmått', 'Area', 'Subarea', 'ObjectID', 'Name'];

    it('should filter out "Area" as a site value (common Swedish header label)', () => {
      const rawValues = ['Area', 'Centrum', 'Norr', 'Syd'];
      const result = sanitizeSiteValues(rawValues, headers);

      expect(result.validSites).not.toContain('Area');
      expect(result.validSites).toContain('Centrum');
      expect(result.validSites).toContain('Norr');
      expect(result.validSites).toContain('Syd');
      expect(result.hadFiltering).toBe(true);
    });

    it('should filter out "Ägare" (Owner) as a site value', () => {
      const rawValues = ['Ägare', 'Centrum'];
      const result = sanitizeSiteValues(rawValues, headers);

      expect(result.validSites).not.toContain('Ägare');
      expect(result.validSites).toContain('Centrum');
    });

    it('should filter out "Subarea" as a site value', () => {
      const rawValues = ['Subarea', 'District 1'];
      const result = sanitizeSiteValues(rawValues, headers);

      expect(result.validSites).not.toContain('Subarea');
      expect(result.validSites).toContain('District 1');
    });

    it('should filter out short non-numeric values (1-2 chars)', () => {
      const rawValues = ['AB', 'X', 'Centrum', '12'];
      const result = sanitizeSiteValues(rawValues, headers);

      expect(result.validSites).not.toContain('AB');
      expect(result.validSites).not.toContain('X');
      expect(result.validSites).toContain('Centrum');
      expect(result.validSites).toContain('12'); // Numeric short values are OK
    });

    it('should filter out values matching column headers (case-insensitive)', () => {
      const rawValues = ['area', 'AREA', 'Area', 'Real Area Name'];
      const result = sanitizeSiteValues(rawValues, headers);

      expect(result.validSites).not.toContain('area');
      expect(result.validSites).not.toContain('AREA');
      expect(result.validSites).not.toContain('Area');
      expect(result.validSites).toContain('Real Area Name');
    });

    it('should deduplicate site values (case-insensitive)', () => {
      const rawValues = ['Centrum', 'centrum', 'CENTRUM', 'Norr'];
      const result = sanitizeSiteValues(rawValues, headers);

      expect(result.validSites.length).toBe(2);
      expect(result.validSites).toContain('Centrum');
      expect(result.validSites).toContain('Norr');
    });

    it('should filter out common English labels', () => {
      const rawValues = ['Owner', 'Organization', 'Site', 'Pump Station 1'];
      const result = sanitizeSiteValues(rawValues, ['Owner', 'Type', 'Site']);

      expect(result.validSites).not.toContain('Owner');
      expect(result.validSites).not.toContain('Organization');
      expect(result.validSites).not.toContain('Site');
      expect(result.validSites).toContain('Pump Station 1');
    });

    it('should return empty array when all values are filtered', () => {
      const rawValues = ['Area', 'Subarea', 'Owner'];
      const result = sanitizeSiteValues(rawValues, headers);

      expect(result.validSites).toHaveLength(0);
      expect(result.hadFiltering).toBe(true);
    });

    it('should handle empty input', () => {
      const result = sanitizeSiteValues([], headers);

      expect(result.validSites).toHaveLength(0);
      expect(result.hadFiltering).toBe(false);
    });
  });

  describe('isValidSiteValue', () => {
    const headers = ['Area', 'Name', 'Type'];

    it('should return false for denylist values', () => {
      expect(isValidSiteValue('area', headers)).toBe(false);
      expect(isValidSiteValue('owner', headers)).toBe(false);
      expect(isValidSiteValue('ägare', headers)).toBe(false);
    });

    it('should return false for column header matches', () => {
      expect(isValidSiteValue('Area', headers)).toBe(false);
      expect(isValidSiteValue('Name', headers)).toBe(false);
      expect(isValidSiteValue('Type', headers)).toBe(false);
    });

    it('should return true for valid site names', () => {
      expect(isValidSiteValue('Water Treatment Plant', headers)).toBe(true);
      expect(isValidSiteValue('Pump Station 1', headers)).toBe(true);
      expect(isValidSiteValue('Centrum', headers)).toBe(true);
    });
  });

  describe('getDataRows', () => {
    const headers = ['Area', 'Name', 'ObjectID'];

    it('should return data rows with detection info', () => {
      const allRows = [
        { Area: 'Area', Name: 'Name', ObjectID: 'ObjectID' }, // Header row
        { Area: 'Centrum', Name: 'Ledning A', ObjectID: 12345 },
        { Area: 'Norr', Name: 'Ledning B', ObjectID: 12346 },
      ];

      const { rows, detection } = getDataRows(allRows, headers, 'ObjectID');

      expect(rows.length).toBe(2);
      expect(detection.skippedRows).toBe(1);
      expect(rows[0].Name).toBe('Ledning A');
    });

    it('should return all rows when first row is data', () => {
      const allRows = [
        { Area: 'Centrum', Name: 'Ledning A', ObjectID: 12345 },
        { Area: 'Norr', Name: 'Ledning B', ObjectID: 12346 },
      ];

      const { rows, detection } = getDataRows(allRows, headers, 'ObjectID');

      expect(rows.length).toBe(2);
      expect(detection.skippedRows).toBe(0);
    });
  });

  describe('Real-world Swedish GIS export scenario', () => {
    /**
     * This test simulates the kva_ledningar_vatten sheet scenario
     * where "Area" was being detected as a site value.
     */
    it('should not detect "Area" as a site when it is a header label', () => {
      const headers = ['Ägare', 'Ledningstyp', 'Mätmått', 'Area', 'Subarea', 'OBJECTID'];
      
      // Row 0: Swedish labels (should be skipped)
      // Row 1+: Real data
      const rows = [
        { Ägare: 'Ägare', Ledningstyp: 'Ledningstyp', Mätmått: 'Mätmått', Area: 'Area', Subarea: 'Subarea', OBJECTID: 'OBJECTID' },
        { Ägare: 'Kommunen', Ledningstyp: 'V', Mätmått: '100', Area: 'Centrum', Subarea: 'A1', OBJECTID: 1001 },
        { Ägare: 'Kommunen', Ledningstyp: 'V', Mätmått: '150', Area: 'Norr', Subarea: 'B2', OBJECTID: 1002 },
      ];

      // Get data rows (should skip first row)
      const { rows: dataRows, detection } = getDataRows(rows, headers, 'OBJECTID');
      expect(detection.skippedRows).toBe(1);
      expect(dataRows.length).toBe(2);

      // Extract site values from data rows only
      const rawSiteValues = dataRows.map(r => r.Area as string);
      const sanitized = sanitizeSiteValues(rawSiteValues, headers);

      // "Area" should NOT appear (it was only in the skipped header row)
      // Only real site values should appear
      expect(sanitized.validSites).not.toContain('Area');
      expect(sanitized.validSites).toContain('Centrum');
      expect(sanitized.validSites).toContain('Norr');
    });
  });
});
