import { TargetEntity, FieldCriticality } from '@prisma/client';
import {
  getRegistryFields,
  getFieldDefinition,
  isValidTargetField,
  getValidFieldKeys,
  validateTargetFields,
  getRequiredFields,
  getFieldsByCriticality,
  getCanonicalFieldsForApi,
} from './canonical-registry';

describe('CanonicalRegistry', () => {
  describe('getRegistryFields', () => {
    it('should return fields for asset entity', () => {
      const fields = getRegistryFields(TargetEntity.asset);
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some((f) => f.key === 'name')).toBe(true);
      expect(fields.some((f) => f.key === 'installedOn')).toBe(true);
    });

    it('should return fields for assetType entity', () => {
      const fields = getRegistryFields(TargetEntity.assetType);
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some((f) => f.key === 'code')).toBe(true);
      expect(fields.some((f) => f.key === 'name')).toBe(true);
    });

    it('should return fields for site entity', () => {
      const fields = getRegistryFields(TargetEntity.site);
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some((f) => f.key === 'name')).toBe(true);
    });

    it('should return fields for maintenanceItem entity', () => {
      const fields = getRegistryFields(TargetEntity.maintenanceItem);
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some((f) => f.key === 'kind')).toBe(true);
      expect(fields.some((f) => f.key === 'costEur')).toBe(true);
    });
  });

  describe('getFieldDefinition', () => {
    it('should return field definition for valid field', () => {
      const field = getFieldDefinition(TargetEntity.asset, 'name');
      expect(field).toBeDefined();
      expect(field?.key).toBe('name');
      expect(field?.type).toBe('string');
      expect(field?.criticality).toBe(FieldCriticality.law_critical);
    });

    it('should return undefined for invalid field', () => {
      const field = getFieldDefinition(TargetEntity.asset, 'nonexistent');
      expect(field).toBeUndefined();
    });

    it('should return field with correct type info', () => {
      const dateField = getFieldDefinition(TargetEntity.asset, 'installedOn');
      expect(dateField?.type).toBe('date');

      const enumField = getFieldDefinition(TargetEntity.asset, 'criticality');
      expect(enumField?.type).toBe('enum');
      expect(enumField?.enumValues).toContain('low');
      expect(enumField?.enumValues).toContain('high');

      const decimalField = getFieldDefinition(TargetEntity.asset, 'replacementCostEur');
      expect(decimalField?.type).toBe('decimal');
    });
  });

  describe('isValidTargetField', () => {
    it('should return true for valid asset fields', () => {
      expect(isValidTargetField(TargetEntity.asset, 'name')).toBe(true);
      expect(isValidTargetField(TargetEntity.asset, 'installedOn')).toBe(true);
      expect(isValidTargetField(TargetEntity.asset, 'replacementCostEur')).toBe(true);
    });

    it('should return false for invalid fields', () => {
      expect(isValidTargetField(TargetEntity.asset, 'invalid')).toBe(false);
      expect(isValidTargetField(TargetEntity.asset, '')).toBe(false);
      expect(isValidTargetField(TargetEntity.asset, 'foobar')).toBe(false);
    });

    it('should validate fields per entity type', () => {
      // assetTypeId is valid for asset but not for site
      expect(isValidTargetField(TargetEntity.asset, 'assetTypeId')).toBe(true);
      expect(isValidTargetField(TargetEntity.site, 'assetTypeId')).toBe(false);
    });
  });

  describe('getValidFieldKeys', () => {
    it('should return array of valid field keys', () => {
      const keys = getValidFieldKeys(TargetEntity.asset);
      expect(Array.isArray(keys)).toBe(true);
      expect(keys).toContain('name');
      expect(keys).toContain('installedOn');
    });
  });

  describe('validateTargetFields', () => {
    it('should validate all fields are valid', () => {
      const result = validateTargetFields(TargetEntity.asset, ['name', 'installedOn', 'lifeYears']);
      expect(result.valid).toBe(true);
      expect(result.invalidFields).toHaveLength(0);
    });

    it('should detect invalid fields', () => {
      const result = validateTargetFields(TargetEntity.asset, ['name', 'invalid', 'alsoInvalid']);
      expect(result.valid).toBe(false);
      expect(result.invalidFields).toContain('invalid');
      expect(result.invalidFields).toContain('alsoInvalid');
      expect(result.invalidFields).not.toContain('name');
    });

    it('should handle empty array', () => {
      const result = validateTargetFields(TargetEntity.asset, []);
      expect(result.valid).toBe(true);
      expect(result.invalidFields).toHaveLength(0);
    });
  });

  describe('getRequiredFields', () => {
    it('should return required fields for asset', () => {
      const required = getRequiredFields(TargetEntity.asset);
      expect(required.length).toBeGreaterThan(0);
      expect(required.some((f) => f.key === 'name')).toBe(true);
    });

    it('should return required fields for assetType', () => {
      const required = getRequiredFields(TargetEntity.assetType);
      expect(required.some((f) => f.key === 'code')).toBe(true);
      expect(required.some((f) => f.key === 'name')).toBe(true);
    });
  });

  describe('getFieldsByCriticality', () => {
    it('should filter fields by law_critical', () => {
      const lawCritical = getFieldsByCriticality(TargetEntity.asset, FieldCriticality.law_critical);
      expect(lawCritical.length).toBeGreaterThan(0);
      expect(lawCritical.every((f) => f.criticality === FieldCriticality.law_critical)).toBe(true);
    });

    it('should filter fields by optional', () => {
      const optional = getFieldsByCriticality(TargetEntity.asset, FieldCriticality.optional);
      expect(optional.length).toBeGreaterThan(0);
      expect(optional.every((f) => f.criticality === FieldCriticality.optional)).toBe(true);
    });
  });

  describe('getCanonicalFieldsForApi', () => {
    it('should return fields for all entities when no entity specified', () => {
      const result = getCanonicalFieldsForApi();
      expect(result.fields.length).toBeGreaterThan(0);
      expect(result.fields.some((f) => f.entity === TargetEntity.asset)).toBe(true);
      expect(result.fields.some((f) => f.entity === TargetEntity.site)).toBe(true);
    });

    it('should return fields for specific entity', () => {
      const result = getCanonicalFieldsForApi(TargetEntity.asset);
      expect(result.fields.length).toBeGreaterThan(0);
      expect(result.fields.every((f) => f.entity === TargetEntity.asset)).toBe(true);
    });

    it('should include all required API fields', () => {
      const result = getCanonicalFieldsForApi(TargetEntity.asset);
      const field = result.fields.find((f) => f.field === 'name');
      expect(field).toBeDefined();
      expect(field?.label).toBeDefined();
      expect(field?.type).toBeDefined();
      expect(field?.criticality).toBeDefined();
      expect(field?.required).toBeDefined();
      expect(field?.examples).toBeDefined();
    });
  });
});
