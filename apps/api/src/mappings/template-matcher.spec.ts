import {
  matchTemplateToSheet,
  findMatchingTemplates,
  getBestTemplate,
  TemplateForMatching,
  SheetForMatching,
} from './template-matcher';

describe('TemplateMatcher', () => {
  const createTemplate = (
    id: string,
    name: string,
    columns: string[],
  ): TemplateForMatching => ({
    id,
    name,
    columns: columns.map((col) => ({ sourceColumn: col, targetField: col })),
  });

  const createSheet = (headers: string[]): SheetForMatching => ({
    headers,
    columnsProfile: headers.map((h, i) => ({
      headerRaw: h,
      headerNormalized: h.toLowerCase(),
      columnIndex: i,
      inferredType: 'string' as const,
      emptyRate: 0,
      exampleValues: ['value'],
      detectedUnits: [],
      nonEmptyCount: 10,
      totalCount: 10,
    })),
  });

  describe('matchTemplateToSheet', () => {
    it('should return high confidence for exact header matches', () => {
      const template = createTemplate('t1', 'Test Template', [
        'Name',
        'Year',
        'Cost',
      ]);
      const sheet = createSheet(['Name', 'Year', 'Cost']);

      const result = matchTemplateToSheet(template, sheet);

      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.matchedColumns).toBe(3);
      expect(result.totalTemplateColumns).toBe(3);
    });

    it('should return high confidence for case-insensitive matches', () => {
      const template = createTemplate('t1', 'Test Template', [
        'name',
        'year',
        'cost',
      ]);
      const sheet = createSheet(['NAME', 'YEAR', 'COST']);

      const result = matchTemplateToSheet(template, sheet);

      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.matchedColumns).toBe(3);
    });

    it('should return partial confidence for partial matches', () => {
      const template = createTemplate('t1', 'Test Template', [
        'Name',
        'Year',
        'Cost',
        'Description',
      ]);
      const sheet = createSheet(['Name', 'Year']);

      const result = matchTemplateToSheet(template, sheet);

      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.matchedColumns).toBe(2);
    });

    it('should return low confidence for no matches', () => {
      const template = createTemplate('t1', 'Test Template', [
        'Alpha',
        'Beta',
        'Gamma',
      ]);
      const sheet = createSheet(['Foo', 'Bar', 'Baz']);

      const result = matchTemplateToSheet(template, sheet);

      expect(result.confidence).toBeLessThan(0.3);
      expect(result.matchedColumns).toBe(0);
    });

    it('should handle fuzzy matches', () => {
      const template = createTemplate('t1', 'Test Template', [
        'Asset Name',
        'Installation Year',
      ]);
      const sheet = createSheet(['AssetName', 'Install Year']);

      const result = matchTemplateToSheet(template, sheet);

      // Should find some match due to fuzzy matching
      expect(result.matchedColumns).toBeGreaterThanOrEqual(1);
    });

    it('should provide match details for each column', () => {
      const template = createTemplate('t1', 'Test Template', ['Name', 'Year']);
      const sheet = createSheet(['Name', 'Cost']);

      const result = matchTemplateToSheet(template, sheet);

      expect(result.matchDetails).toHaveLength(2);
      expect(result.matchDetails[0].sourceColumn).toBe('Name');
      expect(result.matchDetails[0].matchedHeader).toBe('Name');
      expect(result.matchDetails[0].confidence).toBeGreaterThan(0.9);
    });
  });

  describe('findMatchingTemplates', () => {
    it('should return templates sorted by confidence', () => {
      const templates = [
        createTemplate('t1', 'Poor Match', ['Foo', 'Bar']),
        createTemplate('t2', 'Good Match', ['Name', 'Year', 'Cost']),
        createTemplate('t3', 'Partial Match', ['Name', 'Unknown']),
      ];
      const sheet = createSheet(['Name', 'Year', 'Cost']);

      const results = findMatchingTemplates(templates, sheet);

      // Should have at least the good match
      expect(results.length).toBeGreaterThan(0);
      // First result should be the best match
      expect(results[0].templateId).toBe('t2');
    });

    it('should filter out templates below minimum confidence', () => {
      const templates = [
        createTemplate('t1', 'No Match', ['Foo', 'Bar', 'Baz']),
        createTemplate('t2', 'Good Match', ['Name', 'Year', 'Cost']),
      ];
      const sheet = createSheet(['Name', 'Year', 'Cost']);

      const results = findMatchingTemplates(templates, sheet, 0.5);

      // Should only include templates above threshold
      expect(results.every((r) => r.confidence >= 0.5)).toBe(true);
    });

    it('should handle empty template list', () => {
      const sheet = createSheet(['Name', 'Year']);

      const results = findMatchingTemplates([], sheet);

      expect(results).toHaveLength(0);
    });

    it('should handle empty sheet headers', () => {
      const templates = [createTemplate('t1', 'Test', ['Name', 'Year'])];
      const sheet = createSheet([]);

      const results = findMatchingTemplates(templates, sheet);

      expect(results.every((r) => r.confidence < 0.3)).toBe(true);
    });
  });

  describe('getBestTemplate', () => {
    it('should return best template when above threshold', () => {
      const templates = [
        createTemplate('t1', 'Good Match', ['Name', 'Year', 'Cost']),
      ];
      const sheet = createSheet(['Name', 'Year', 'Cost']);

      const result = getBestTemplate(templates, sheet, 0.7);

      expect(result).not.toBeNull();
      expect(result?.templateId).toBe('t1');
    });

    it('should return null when no template meets threshold', () => {
      const templates = [
        createTemplate('t1', 'Poor Match', ['Foo', 'Bar', 'Baz']),
      ];
      const sheet = createSheet(['Name', 'Year', 'Cost']);

      const result = getBestTemplate(templates, sheet, 0.7);

      expect(result).toBeNull();
    });

    it('should return null for empty template list', () => {
      const sheet = createSheet(['Name', 'Year']);

      const result = getBestTemplate([], sheet);

      expect(result).toBeNull();
    });
  });

  describe('real-world scenarios', () => {
    it('should match water utility asset templates', () => {
      const template = createTemplate('water-assets', 'Water Utility Assets', [
        'Tunnus',
        'Nimi',
        'Rakennusvuosi',
        'Käyttöikä',
        'Kustannus',
      ]);
      const sheet = createSheet([
        'Tunnus',
        'Nimi',
        'Rakennusvuosi',
        'Käyttöikä',
        'Kustannus EUR',
        'Huomautukset',
      ]);

      const result = matchTemplateToSheet(template, sheet);

      expect(result.matchedColumns).toBeGreaterThanOrEqual(4);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should handle Swedish column names', () => {
      const template = createTemplate('swedish-assets', 'Swedish Assets', [
        'Namn',
        'Byggår',
        'Livslängd',
        'Pris',
      ]);
      const sheet = createSheet([
        'Namn',
        'Byggår',
        'Livslängd',
        'Pris',
      ]);

      const result = matchTemplateToSheet(template, sheet);

      expect(result.matchedColumns).toBe(4);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should handle normalized header variations', () => {
      const template = createTemplate('t1', 'Test', [
        'asset_name',
        'installation_year',
      ]);
      const sheet = createSheet([
        'Asset Name',
        'Installation Year',
      ]);

      const result = matchTemplateToSheet(template, sheet);

      // Should match due to normalization
      expect(result.matchedColumns).toBeGreaterThanOrEqual(1);
    });
  });
});
