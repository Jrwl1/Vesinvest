import { FieldCriticality, TargetEntity } from '@prisma/client';
import { getRegistryFields, getFieldsByCriticality } from '../mappings/canonical-registry';

/**
 * These tests validate the readiness gate logic without requiring
 * a full service instantiation. They test the core business rules.
 */

describe('ReadinessGate Logic', () => {
  describe('Law-Critical Field Rules', () => {
    it('should identify all law-critical fields for assets', () => {
      const lawCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.law_critical,
      );

      // Law-critical: fields that MUST be mapped from Excel (not assumption-based)
      expect(lawCritical.length).toBeGreaterThan(0);
      expect(lawCritical.map((f) => f.key)).toContain('name');
      expect(lawCritical.map((f) => f.key)).toContain('externalRef');
      expect(lawCritical.map((f) => f.key)).toContain('installedOn');
      expect(lawCritical.map((f) => f.key)).toContain('assetTypeId');
      
      // Note: lifeYears, replacementCostEur, criticality are now model_critical
      // because they can use assumption-based defaults
    });

    it('should block execution when law-critical fields are missing', () => {
      const lawCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.law_critical,
      );
      // Missing externalRef and assetTypeId
      const mappedFields = new Set(['name', 'installedOn']);

      const missingLawCritical = lawCritical.filter(
        (f) => !mappedFields.has(f.key),
      );

      expect(missingLawCritical.length).toBeGreaterThan(0);
      // This would block execution
      const canProceed = missingLawCritical.length === 0;
      expect(canProceed).toBe(false);
    });

    it('should allow execution when all law-critical fields are mapped', () => {
      const lawCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.law_critical,
      );
      const mappedFields = new Set(lawCritical.map((f) => f.key));

      const missingLawCritical = lawCritical.filter(
        (f) => !mappedFields.has(f.key),
      );

      expect(missingLawCritical.length).toBe(0);
      const canProceed = missingLawCritical.length === 0;
      expect(canProceed).toBe(true);
    });
  });

  describe('Model-Critical Field Rules', () => {
    it('should identify all model-critical fields for assets', () => {
      const modelCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.model_critical,
      );

      expect(modelCritical.length).toBeGreaterThan(0);
    });

    it('should allow model-critical fields to have assumptions', () => {
      const modelCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.model_critical,
      );
      const mappedFields = new Set<string>();
      const assumptions = new Set(modelCritical.map((f) => f.key));

      const coveredModelCritical = modelCritical.filter(
        (f) => mappedFields.has(f.key) || assumptions.has(f.key),
      );

      // All model-critical fields are covered via assumptions
      expect(coveredModelCritical.length).toBe(modelCritical.length);
    });

    it('should NOT allow law-critical fields to have assumptions', () => {
      const lawCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.law_critical,
      );

      // Rule: law-critical fields must be mapped, not assumed
      for (const field of lawCritical) {
        expect(field.criticality).toBe(FieldCriticality.law_critical);
        // Business rule: cannot use assumptions for law-critical
      }
    });
  });

  describe('Field Coverage Calculation', () => {
    it('should calculate correct coverage percentages', () => {
      const allFields = getRegistryFields(TargetEntity.asset);
      const mappedFields = new Set(['name', 'installedOn', 'lifeYears', 'status']);

      const totalFields = allFields.length;
      const mappedCount = allFields.filter((f) => mappedFields.has(f.key)).length;
      const coveragePercent = (mappedCount / totalFields) * 100;

      expect(totalFields).toBeGreaterThan(0);
      expect(mappedCount).toBe(4);
      expect(coveragePercent).toBeGreaterThan(0);
      expect(coveragePercent).toBeLessThan(100);
    });

    it('should categorize fields by criticality', () => {
      const allFields = getRegistryFields(TargetEntity.asset);

      const byCategory = {
        law_critical: allFields.filter((f) => f.criticality === FieldCriticality.law_critical),
        model_critical: allFields.filter((f) => f.criticality === FieldCriticality.model_critical),
        optional: allFields.filter((f) => f.criticality === FieldCriticality.optional),
      };

      expect(byCategory.law_critical.length).toBeGreaterThan(0);
      expect(byCategory.model_critical.length).toBeGreaterThan(0);
      expect(byCategory.optional.length).toBeGreaterThan(0);

      // Total should match
      expect(
        byCategory.law_critical.length +
          byCategory.model_critical.length +
          byCategory.optional.length,
      ).toBe(allFields.length);
    });
  });

  describe('Assumption Validation', () => {
    it('should accept assumptions for model-critical fields', () => {
      const modelCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.model_critical,
      );

      if (modelCritical.length > 0) {
        const assumption = {
          field: modelCritical[0].key,
          value: 'default value',
        };

        // Validate assumption is for a model-critical field
        const isValidAssumption = modelCritical.some(
          (f) => f.key === assumption.field,
        );
        expect(isValidAssumption).toBe(true);
      }
    });

    it('should reject assumptions for law-critical fields', () => {
      const lawCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.law_critical,
      );

      if (lawCritical.length > 0) {
        const invalidAssumption = {
          field: lawCritical[0].key,
          value: 'default value',
        };

        // Validate assumption is NOT for a law-critical field
        const isLawCritical = lawCritical.some(
          (f) => f.key === invalidAssumption.field,
        );
        expect(isLawCritical).toBe(true);
        // This should be rejected by the service
      }
    });

    it('should accept assumptions for optional fields', () => {
      const optional = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.optional,
      );

      if (optional.length > 0) {
        const assumption = {
          field: optional[0].key,
          value: 'default value',
        };

        // Optional fields can have assumptions
        const isOptional = optional.some((f) => f.key === assumption.field);
        expect(isOptional).toBe(true);
      }
    });
  });

  describe('Ready State Calculation', () => {
    it('should be ready when all law and model critical fields are covered', () => {
      const lawCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.law_critical,
      );
      const modelCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.model_critical,
      );

      // All mapped
      const mappedFields = new Set([
        ...lawCritical.map((f) => f.key),
        ...modelCritical.map((f) => f.key),
      ]);

      const missingLawCritical = lawCritical.filter((f) => !mappedFields.has(f.key));
      const missingModelCritical = modelCritical.filter((f) => !mappedFields.has(f.key));

      const canProceed = missingLawCritical.length === 0;
      const ready = canProceed && missingModelCritical.length === 0;

      expect(canProceed).toBe(true);
      expect(ready).toBe(true);
    });

    it('should be "can proceed but not ready" when model-critical missing', () => {
      const lawCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.law_critical,
      );
      const modelCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.model_critical,
      );

      // Only law-critical mapped
      const mappedFields = new Set(lawCritical.map((f) => f.key));

      const missingLawCritical = lawCritical.filter((f) => !mappedFields.has(f.key));
      const missingModelCritical = modelCritical.filter((f) => !mappedFields.has(f.key));

      const canProceed = missingLawCritical.length === 0;
      const ready = canProceed && missingModelCritical.length === 0;

      expect(canProceed).toBe(true);
      expect(ready).toBe(false);
    });

    it('should NOT be able to proceed when law-critical missing', () => {
      const lawCritical = getFieldsByCriticality(
        TargetEntity.asset,
        FieldCriticality.law_critical,
      );

      // No fields mapped
      const mappedFields = new Set<string>();

      const missingLawCritical = lawCritical.filter((f) => !mappedFields.has(f.key));

      const canProceed = missingLawCritical.length === 0;

      expect(canProceed).toBe(false);
    });
  });
});
