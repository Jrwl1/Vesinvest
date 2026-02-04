/**
 * Tests for mapping suggestions: ageYears detection and installedOn/age column detection.
 * Ensures age-based import patterns (sv/fi/en) are detected.
 */

import { suggestMappings } from './mapping-suggestions';

describe('Mapping Suggestions', () => {
  describe('ageYears detection', () => {
    it('should suggest ageYears for "age" column', () => {
      const suggestions = suggestMappings(['Name', 'Age', 'ID']);
      const age = suggestions.find((s) => s.targetField === 'ageYears');
      expect(age).toBeDefined();
      expect(age?.sourceColumn).toBe('Age');
      expect(age?.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should suggest ageYears for Swedish "ålder"', () => {
      const suggestions = suggestMappings(['Namn', 'Ålder', 'ObjectID']);
      const age = suggestions.find((s) => s.targetField === 'ageYears');
      expect(age).toBeDefined();
      expect(age?.sourceColumn).toBe('Ålder');
    });

    it('should suggest ageYears for Finnish "ikä"', () => {
      const suggestions = suggestMappings(['Nimi', 'Ikä', 'Tunnus']);
      const age = suggestions.find((s) => s.targetField === 'ageYears');
      expect(age).toBeDefined();
      expect(age?.sourceColumn).toBe('Ikä');
    });

    it('should suggest ageYears for "years" column', () => {
      const suggestions = suggestMappings(['Name', 'Years', 'Code']);
      const age = suggestions.find((s) => s.targetField === 'ageYears');
      expect(age).toBeDefined();
    });

    it('should suggest ageYears for "vuotta" (Finnish)', () => {
      const suggestions = suggestMappings(['Nimi', 'Vuotta']);
      const age = suggestions.find((s) => s.targetField === 'ageYears');
      expect(age).toBeDefined();
    });
  });

  describe('installedOn vs ageYears', () => {
    it('should suggest both installedOn and ageYears when both columns present', () => {
      const suggestions = suggestMappings(['Name', 'Installation year', 'Age (years)', 'ID']);
      const installedOn = suggestions.find((s) => s.targetField === 'installedOn');
      const ageYears = suggestions.find((s) => s.targetField === 'ageYears');
      expect(installedOn).toBeDefined();
      expect(ageYears).toBeDefined();
    });
  });
});
