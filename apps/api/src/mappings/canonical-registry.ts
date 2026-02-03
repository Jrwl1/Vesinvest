/**
 * Canonical Field Registry - Production-safe type definitions for import mapping
 *
 * This registry defines all valid target fields for each entity type.
 * The targetField in MappingColumn MUST exist in this registry.
 */

import { TargetEntity, FieldCriticality } from '@prisma/client';

export type CanonicalFieldType = 'string' | 'number' | 'date' | 'decimal' | 'enum' | 'boolean';

export interface CanonicalFieldDefinition {
  /** Stable field key - this is what gets stored in MappingColumn.targetField */
  key: string;
  /** Human-readable label */
  label: string;
  /** Data type for transformation */
  type: CanonicalFieldType;
  /** Criticality level */
  criticality: FieldCriticality;
  /** For enum types, valid values */
  enumValues?: string[];
  /** Example column headers that might match this field (for suggestions) */
  synonyms: string[];
  /** Regex patterns for auto-detection */
  patterns: RegExp[];
  /** Description for UI */
  description?: string;
  /** Whether this field is required for successful import */
  required?: boolean;
}

// ============================================
// Asset Entity Registry
// ============================================

const ASSET_FIELDS: CanonicalFieldDefinition[] = [
  {
    key: 'name',
    label: 'Asset Name',
    type: 'string',
    criticality: FieldCriticality.law_critical,
    required: true,
    synonyms: ['name', 'asset name', 'description', 'nimike', 'nimi', 'namn', 'benämning'],
    patterns: [/^name$/i, /^asset.?name$/i, /^description$/i, /^nimike$/i, /^nimi$/i],
    description: 'Unique identifier name for the asset',
  },
  {
    key: 'externalRef',
    label: 'Asset Identity (External Ref)',
    type: 'string',
    criticality: FieldCriticality.law_critical,
    required: true,
    synonyms: ['id', 'ref', 'external ref', 'code', 'nummer', 'tunnus', 'koodi', 'external id', 'asset id', 'internal id'],
    patterns: [/^(external)?.*ref/i, /^id$/i, /^code$/i, /^nummer/i, /^tunnus/i, /^asset.?id$/i],
    description: 'Business identity for the asset. Required for all law-critical assets. Immutable after creation.',
  },
  {
    key: 'installedOn',
    label: 'Installation Date',
    type: 'date',
    criticality: FieldCriticality.law_critical,
    synonyms: [
      'installed', 'installation date', 'installation year', 'byggår', 'byggnadsår',
      'rakennusvuosi', 'built', 'construction year', 'year', 'år', 'vuosi',
    ],
    patterns: [/install/i, /^(bygg|rakennus|construction|built)/i, /^år$/i, /^vuosi$/i, /^year$/i],
    description: 'Date or year when the asset was installed',
  },
  {
    key: 'lifeYears',
    label: 'Expected Lifetime (Years)',
    type: 'number',
    criticality: FieldCriticality.law_critical,
    synonyms: [
      'life', 'life years', 'lifespan', 'expected life', 'technical life',
      'livslängd', 'teknisk livslängd', 'käyttöikä', 'elinikä',
    ],
    patterns: [/life/i, /livslängd/i, /käyttöikä/i, /elinikä/i, /^(expected|technical)?.*life/i],
    description: 'Expected technical lifetime in years',
  },
  {
    key: 'replacementCostEur',
    label: 'Replacement Cost (EUR)',
    type: 'decimal',
    criticality: FieldCriticality.law_critical,
    synonyms: [
      'cost', 'replacement cost', 'price', 'pris', 'återanskaffningsvärde',
      'hinta', 'kustannus', 'arvo', 'value', 'eur', 'replacement value',
    ],
    patterns: [/cost/i, /pris/i, /hinta/i, /kustannus/i, /replacement/i, /återanskaffning/i],
    description: 'Replacement cost in EUR',
  },
  {
    key: 'criticality',
    label: 'Criticality Level',
    type: 'enum',
    criticality: FieldCriticality.law_critical,
    enumValues: ['low', 'medium', 'high'],
    synonyms: ['criticality', 'critical', 'risk', 'priority', 'kriittisyys', 'prioritet', 'riskiklass'],
    patterns: [/critic/i, /risk/i, /priorit/i, /kriittisyys/i],
    description: 'Asset criticality level (low, medium, high)',
  },
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    criticality: FieldCriticality.model_critical,
    enumValues: ['active', 'inactive', 'retired'],
    synonyms: ['status', 'state', 'active', 'tila', 'tillstånd'],
    patterns: [/status/i, /state/i, /tila/i, /tillstånd/i],
    description: 'Asset status (active, inactive, retired)',
  },
  {
    key: 'siteId',
    label: 'Site',
    type: 'string',
    criticality: FieldCriticality.model_critical,
    synonyms: ['site', 'location', 'area', 'plats', 'sijainti', 'område', 'alue'],
    patterns: [/site/i, /location/i, /plats/i, /sijainti/i, /area/i, /område/i],
    description: 'Site name or ID where the asset is located',
  },
  {
    key: 'assetTypeId',
    label: 'Asset Type',
    type: 'string',
    criticality: FieldCriticality.law_critical,
    synonyms: ['type', 'asset type', 'category', 'typ', 'luokka', 'kategori'],
    patterns: [/type/i, /category/i, /typ$/i, /luokka/i, /kategori/i],
    description: 'Asset type code or name',
  },
  {
    key: 'notes',
    label: 'Notes',
    type: 'string',
    criticality: FieldCriticality.optional,
    synonyms: ['notes', 'note', 'comments', 'remarks', 'huomautukset', 'anmärkningar'],
    patterns: [/note/i, /comment/i, /remark/i, /huom/i, /anmärk/i],
    description: 'Additional notes or comments',
  },
  {
    key: 'ownerRole',
    label: 'Owner Role',
    type: 'string',
    criticality: FieldCriticality.optional,
    synonyms: ['owner', 'responsible', 'vastuuhenkilö', 'ansvarig'],
    patterns: [/owner/i, /responsible/i, /vastuuhenkilö/i, /ansvarig/i],
    description: 'Role responsible for the asset',
  },
  {
    key: 'lengthMeters',
    label: 'Length (meters)',
    type: 'decimal',
    criticality: FieldCriticality.model_critical,
    synonyms: ['length', 'length (m)', 'längd', 'längd (m)', 'pituus', 'pituus (m)', 'meters', 'm'],
    patterns: [/length/i, /längd/i, /pituus/i, /^m$/i, /meter/i],
    description: 'Length in meters (for pipes, cables, etc.)',
  },
  {
    key: 'diameterMm',
    label: 'Diameter (mm)',
    type: 'number',
    criticality: FieldCriticality.optional,
    synonyms: ['diameter', 'dn', 'dimension', 'halkaisija', 'mm'],
    patterns: [/diameter/i, /dimension/i, /dn$/i, /^mm$/i, /halkaisija/i],
    description: 'Diameter in millimeters',
  },
  {
    key: 'material',
    label: 'Material',
    type: 'string',
    criticality: FieldCriticality.optional,
    synonyms: ['material', 'materiaali', 'material typ'],
    patterns: [/material/i, /materiaali/i],
    description: 'Material type',
  },
];

// ============================================
// Asset Type Entity Registry
// ============================================

const ASSET_TYPE_FIELDS: CanonicalFieldDefinition[] = [
  {
    key: 'code',
    label: 'Type Code',
    type: 'string',
    criticality: FieldCriticality.law_critical,
    required: true,
    synonyms: ['code', 'type code', 'koodi', 'kod'],
    patterns: [/code/i, /koodi/i, /kod/i],
    description: 'Unique type code',
  },
  {
    key: 'name',
    label: 'Type Name',
    type: 'string',
    criticality: FieldCriticality.law_critical,
    required: true,
    synonyms: ['name', 'type name', 'nimi', 'namn'],
    patterns: [/name/i, /nimi/i, /namn/i],
    description: 'Type display name',
  },
  {
    key: 'defaultLifeYears',
    label: 'Default Lifetime (Years)',
    type: 'number',
    criticality: FieldCriticality.model_critical,
    synonyms: ['default life', 'life years', 'käyttöikä', 'livslängd'],
    patterns: [/life/i, /käyttöikä/i, /livslängd/i],
    description: 'Default expected lifetime in years',
  },
];

// ============================================
// Site Entity Registry
// ============================================

const SITE_FIELDS: CanonicalFieldDefinition[] = [
  {
    key: 'name',
    label: 'Site Name',
    type: 'string',
    criticality: FieldCriticality.law_critical,
    required: true,
    synonyms: ['name', 'site', 'location', 'nimi', 'plats'],
    patterns: [/name/i, /site/i, /location/i],
    description: 'Site name',
  },
  {
    key: 'address',
    label: 'Address',
    type: 'string',
    criticality: FieldCriticality.optional,
    synonyms: ['address', 'osoite', 'adress'],
    patterns: [/address/i, /osoite/i, /adress/i],
    description: 'Site address',
  },
];

// ============================================
// Maintenance Item Entity Registry
// ============================================

const MAINTENANCE_ITEM_FIELDS: CanonicalFieldDefinition[] = [
  {
    key: 'assetId',
    label: 'Asset Reference',
    type: 'string',
    criticality: FieldCriticality.law_critical,
    required: true,
    synonyms: ['asset', 'asset id', 'asset ref', 'kohde'],
    patterns: [/asset/i, /kohde/i],
    description: 'Reference to the asset',
  },
  {
    key: 'kind',
    label: 'Maintenance Kind',
    type: 'enum',
    criticality: FieldCriticality.law_critical,
    required: true,
    enumValues: ['MAINTENANCE', 'REPLACEMENT'],
    synonyms: ['kind', 'type', 'tyyppi', 'typ'],
    patterns: [/kind/i, /type/i, /tyyppi/i],
    description: 'MAINTENANCE or REPLACEMENT',
  },
  {
    key: 'intervalYears',
    label: 'Interval (Years)',
    type: 'number',
    criticality: FieldCriticality.law_critical,
    required: true,
    synonyms: ['interval', 'frequency', 'years', 'väli'],
    patterns: [/interval/i, /frequency/i, /väli/i],
    description: 'Interval between maintenance in years',
  },
  {
    key: 'costEur',
    label: 'Cost (EUR)',
    type: 'decimal',
    criticality: FieldCriticality.law_critical,
    required: true,
    synonyms: ['cost', 'price', 'kustannus', 'hinta'],
    patterns: [/cost/i, /price/i, /kustannus/i, /hinta/i],
    description: 'Cost in EUR',
  },
  {
    key: 'startsAtYear',
    label: 'Start Year',
    type: 'number',
    criticality: FieldCriticality.optional,
    synonyms: ['start', 'starts', 'from year', 'alkaa'],
    patterns: [/start/i, /from/i, /alkaa/i],
    description: 'Year when maintenance starts',
  },
  {
    key: 'endsAtYear',
    label: 'End Year',
    type: 'number',
    criticality: FieldCriticality.optional,
    synonyms: ['end', 'ends', 'to year', 'loppuu'],
    patterns: [/end/i, /to/i, /loppuu/i],
    description: 'Year when maintenance ends',
  },
  {
    key: 'notes',
    label: 'Notes',
    type: 'string',
    criticality: FieldCriticality.optional,
    synonyms: ['notes', 'comments', 'huomiot'],
    patterns: [/note/i, /comment/i, /huom/i],
    description: 'Additional notes',
  },
];

// ============================================
// Registry Access Functions
// ============================================

const REGISTRY: Record<TargetEntity, CanonicalFieldDefinition[]> = {
  [TargetEntity.asset]: ASSET_FIELDS,
  [TargetEntity.assetType]: ASSET_TYPE_FIELDS,
  [TargetEntity.site]: SITE_FIELDS,
  [TargetEntity.maintenanceItem]: MAINTENANCE_ITEM_FIELDS,
};

/**
 * Get all canonical fields for a target entity
 */
export function getRegistryFields(entity: TargetEntity): CanonicalFieldDefinition[] {
  return REGISTRY[entity] || [];
}

/**
 * Get a specific field definition
 */
export function getFieldDefinition(
  entity: TargetEntity,
  fieldKey: string,
): CanonicalFieldDefinition | undefined {
  return REGISTRY[entity]?.find((f) => f.key === fieldKey);
}

/**
 * Check if a target field is valid for an entity
 */
export function isValidTargetField(entity: TargetEntity, fieldKey: string): boolean {
  return REGISTRY[entity]?.some((f) => f.key === fieldKey) ?? false;
}

/**
 * Get all valid field keys for an entity
 */
export function getValidFieldKeys(entity: TargetEntity): string[] {
  return REGISTRY[entity]?.map((f) => f.key) ?? [];
}

/**
 * Validate all target fields in a mapping
 * Returns array of invalid field keys
 */
export function validateTargetFields(
  entity: TargetEntity,
  targetFields: string[],
): { valid: boolean; invalidFields: string[] } {
  const validKeys = new Set(getValidFieldKeys(entity));
  const invalidFields = targetFields.filter((f) => !validKeys.has(f));
  return {
    valid: invalidFields.length === 0,
    invalidFields,
  };
}

/**
 * Get required fields that must be mapped for successful import
 */
export function getRequiredFields(entity: TargetEntity): CanonicalFieldDefinition[] {
  return REGISTRY[entity]?.filter((f) => f.required) ?? [];
}

/**
 * Get fields by criticality level
 */
export function getFieldsByCriticality(
  entity: TargetEntity,
  criticality: FieldCriticality,
): CanonicalFieldDefinition[] {
  return REGISTRY[entity]?.filter((f) => f.criticality === criticality) ?? [];
}

/**
 * Convert registry to API response format (for backward compatibility)
 */
export function getCanonicalFieldsForApi(entity?: TargetEntity) {
  const entities = entity ? [entity] : Object.values(TargetEntity);
  const fields: Array<{
    entity: TargetEntity;
    field: string;
    label: string;
    type: CanonicalFieldType;
    criticality: FieldCriticality;
    required: boolean;
    enumValues?: string[];
    examples: string[];
    description?: string;
  }> = [];

  for (const e of entities) {
    for (const f of REGISTRY[e] || []) {
      fields.push({
        entity: e,
        field: f.key,
        label: f.label,
        type: f.type,
        criticality: f.criticality,
        required: f.required ?? false,
        enumValues: f.enumValues,
        examples: f.synonyms.slice(0, 5),
        description: f.description,
      });
    }
  }

  return { fields };
}
