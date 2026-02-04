/**
 * Mapping suggestion engine for auto-detecting Excel column to canonical field mappings.
 * Supports multiple languages (Swedish, Finnish, English) and common variations.
 */

export interface MappingSuggestion {
  sourceColumn: string;
  targetField: string;
  confidence: number; // 0.0 - 1.0
  reason: string;
}

interface FieldPattern {
  targetField: string;
  patterns: RegExp[];
  exactMatches: string[];
  criticality: 'law_critical' | 'model_critical' | 'optional';
  /** Priority boost for certain patterns (0-1, added to confidence) */
  priorityPatterns?: { pattern: RegExp; boost: number }[];
  /** Patterns that should NOT match this field (negative filter) */
  excludePatterns?: RegExp[];
}

// Canonical field definitions with multi-language patterns
const ASSET_FIELD_PATTERNS: FieldPattern[] = [
  {
    targetField: 'name',
    patterns: [
      /^name$/i,
      /^asset.?name$/i,
      /^description$/i,
      /^nimike$/i,
      /^nimi$/i,
      /materialname|material_name|material$/i,
    ],
    exactMatches: [
      'name',
      'asset name',
      'description',
      'nimike',
      'nimi',
      'namn',
      'benämning',
      'materialname',
      'material_name',
      'material',
    ],
    criticality: 'law_critical',
  },
  {
    targetField: 'externalRef',
    // Priority: FEATUREID/OBJECTID > *_ID > generic patterns
    patterns: [
      /featureid/i,
      /objectid/i,
      /^.*_id$/i,          // Columns ending in _ID
      /^fid$/i,
      /^(external)?.*ref/i,
      /^id$/i,
      /^code$/i,
      /^nummer/i,
      /^tunnus/i,
    ],
    exactMatches: [
      'featureid', 'feature_id', 'objectid', 'object_id', 'fid',
      'asset_id', 'assetid', 'unique_id',
      'id', 'ref', 'external ref', 'code', 'nummer', 'tunnus', 'koodi',
    ],
    criticality: 'law_critical', // Per Asset Identity Contract
    // Boost confidence for GIS-style IDs (most likely to be unique identifiers)
    priorityPatterns: [
      { pattern: /featureid/i, boost: 0.15 },
      { pattern: /objectid/i, boost: 0.15 },
      { pattern: /^.*_featureid$/i, boost: 0.15 },
      { pattern: /^fid$/i, boost: 0.1 },
      { pattern: /^.*_id$/i, boost: 0.05 },
    ],
    // Exclude owner/organization columns - these are NOT asset identities
    excludePatterns: [
      /owner/i,
      /organisation/i,
      /organization/i,
      /org_id/i,
      /orgid/i,
      /company/i,
      /tenant/i,
      /user/i,
      /customer/i,
      /client/i,
      /omistaja/i,        // Finnish: owner
      /ägare/i,           // Swedish: owner
    ],
  },
  {
    targetField: 'installedOn',
    patterns: [
      /install/i,
      /^(bygg|rakennus|construction|built)/i,
      /^år$/i,
      /^vuosi$/i,
      /^year$/i,
    ],
    exactMatches: [
      'installed',
      'installation date',
      'installation year',
      'byggår',
      'byggnadsår',
      'rakennusvuosi',
      'built',
      'construction year',
      'year',
      'år',
      'vuosi',
    ],
    criticality: 'law_critical',
  },
  {
    targetField: 'ageYears',
    patterns: [
      /age/i,
      /ålder/i,
      /ikä/i,
      /years?\s*old/i,
      /vuotta/i,
      /år\s*gammal/i,
    ],
    exactMatches: [
      'age',
      'age (years)',
      'ålder',
      'ikä',
      'years',
      'år',
      'vuotta',
      'age years',
    ],
    criticality: 'model_critical',
  },
  {
    targetField: 'lifeYears',
    patterns: [
      /life/i,
      /livslängd/i,
      /käyttöikä/i,
      /elinikä/i,
      /^(expected|technical)?.*life/i,
    ],
    exactMatches: [
      'life',
      'life years',
      'lifespan',
      'expected life',
      'technical life',
      'livslängd',
      'teknisk livslängd',
      'käyttöikä',
      'elinikä',
    ],
    // Changed to model_critical: can use assumption if not in Excel
    criticality: 'model_critical',
  },
  {
    targetField: 'replacementCostEur',
    patterns: [
      /cost/i,
      /pris/i,
      /hinta/i,
      /kustannus/i,
      /replacement/i,
      /återanskaffning/i,
    ],
    exactMatches: [
      'cost',
      'replacement cost',
      'price',
      'pris',
      'återanskaffningsvärde',
      'hinta',
      'kustannus',
      'arvo',
      'value',
      'eur',
    ],
    // Changed to model_critical: can use estimate if not in Excel
    criticality: 'model_critical',
  },
  {
    targetField: 'criticality',
    patterns: [/critic/i, /risk/i, /priorit/i, /kriittisyys/i],
    exactMatches: [
      'criticality',
      'critical',
      'risk',
      'priority',
      'kriittisyys',
      'prioritet',
      'riskiklass',
    ],
    // Changed to model_critical: default to 'medium' if not in Excel
    criticality: 'model_critical',
  },
  {
    targetField: 'status',
    patterns: [/status/i, /state/i, /tila/i, /tillstånd/i],
    exactMatches: ['status', 'state', 'active', 'tila', 'tillstånd'],
    criticality: 'model_critical',
  },
  {
    targetField: 'notes',
    patterns: [/note/i, /comment/i, /remark/i, /huom/i, /anmärk/i],
    exactMatches: ['notes', 'note', 'comments', 'remarks', 'huomautukset', 'anmärkningar'],
    criticality: 'optional',
  },
  {
    targetField: 'lengthMeters',
    patterns: [/length/i, /längd/i, /pituus/i, /^m$/i, /meter/i],
    exactMatches: ['length', 'length (m)', 'längd', 'längd (m)', 'pituus', 'pituus (m)', 'meters', 'm'],
    criticality: 'model_critical',
  },
  {
    targetField: 'diameterMm',
    patterns: [/diameter/i, /dimension/i, /dn$/i, /^mm$/i, /halkaisija/i],
    exactMatches: ['diameter', 'dn', 'dimension', 'halkaisija', 'mm'],
    criticality: 'optional',
  },
  {
    targetField: 'material',
    patterns: [/material/i, /materiaali/i],
    exactMatches: ['material', 'materiaali', 'material typ'],
    criticality: 'optional',
  },
  {
    targetField: 'siteId',
    patterns: [/site/i, /location/i, /plats/i, /sijainti/i, /area/i, /område/i],
    exactMatches: ['site', 'location', 'area', 'plats', 'sijainti', 'område', 'alue'],
    criticality: 'model_critical',
  },
  {
    targetField: 'assetTypeId',
    patterns: [/type/i, /category/i, /typ$/i, /luokka/i, /kategori/i],
    exactMatches: ['type', 'asset type', 'category', 'typ', 'luokka', 'kategori'],
    criticality: 'law_critical',
  },
];

/**
 * Normalize a column header for matching
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[_\-\s]+/g, ' ')
    .replace(/[()[\]]/g, '')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Generate mapping suggestions for a list of Excel column headers
 */
export function suggestMappings(headers: string[]): MappingSuggestion[] {
  const suggestions: MappingSuggestion[] = [];
  const usedTargets = new Set<string>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let bestMatch: MappingSuggestion | null = null;

    for (const fieldPattern of ASSET_FIELD_PATTERNS) {
      // Skip if this target field is already mapped
      if (usedTargets.has(fieldPattern.targetField)) continue;

      // Check exclude patterns first - skip if this header should NOT match this field
      if (fieldPattern.excludePatterns) {
        let excluded = false;
        for (const excludePattern of fieldPattern.excludePatterns) {
          if (excludePattern.test(header) || excludePattern.test(normalized)) {
            excluded = true;
            break;
          }
        }
        if (excluded) continue;
      }

      let confidence = 0;
      let reason = '';

      // Check exact matches first (highest confidence)
      for (const exact of fieldPattern.exactMatches) {
        if (normalized === exact.toLowerCase()) {
          confidence = 0.95;
          reason = `Exact match: "${exact}"`;
          break;
        }
        // Check if header contains exact match
        if (normalized.includes(exact.toLowerCase())) {
          confidence = Math.max(confidence, 0.8);
          reason = `Contains: "${exact}"`;
        }
      }

      // Check regex patterns
      if (confidence < 0.8) {
        for (const pattern of fieldPattern.patterns) {
          if (pattern.test(header)) {
            confidence = Math.max(confidence, 0.7);
            reason = `Pattern match: ${pattern}`;
            break;
          }
        }
      }

      // Apply priority boosts for high-priority patterns
      if (confidence > 0 && fieldPattern.priorityPatterns) {
        for (const { pattern, boost } of fieldPattern.priorityPatterns) {
          if (pattern.test(header) || pattern.test(normalized)) {
            confidence = Math.min(confidence + boost, 0.99);
            reason += ` (priority: ${pattern})`;
            break;
          }
        }
      }

      // Fuzzy matching for close matches
      if (confidence < 0.6) {
        const targetNormalized = fieldPattern.targetField.toLowerCase();
        const distance = levenshteinDistance(normalized, targetNormalized);
        const maxLen = Math.max(normalized.length, targetNormalized.length);
        const similarity = 1 - distance / maxLen;

        if (similarity > 0.7) {
          confidence = similarity * 0.6; // Scale down fuzzy matches
          reason = `Fuzzy match (${Math.round(similarity * 100)}% similar)`;
        }
      }

      // Update best match if this is better
      if (confidence > (bestMatch?.confidence ?? 0.3)) {
        bestMatch = {
          sourceColumn: header,
          targetField: fieldPattern.targetField,
          confidence,
          reason,
        };
      }
    }

    if (bestMatch) {
      suggestions.push(bestMatch);
      usedTargets.add(bestMatch.targetField);
    }
  }

  // Sort by confidence descending
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get the canonical field definitions (for UI display)
 */
export function getCanonicalFields() {
  return ASSET_FIELD_PATTERNS.map((fp) => ({
    field: fp.targetField,
    criticality: fp.criticality,
    examples: fp.exactMatches.slice(0, 3),
  }));
}
