/**
 * Template Matcher - Matches Excel sheets to saved mapping templates
 * Uses header similarity and column profiles to find best matching template
 */

import { normalizeHeader } from '../imports/column-profiler';
import type { ColumnProfile } from '../imports/column-profiler';

export interface TemplateMatchResult {
  templateId: string;
  templateName: string;
  confidence: number; // 0.0 - 1.0
  matchedColumns: number;
  totalTemplateColumns: number;
  totalSheetColumns: number;
  matchDetails: Array<{
    sourceColumn: string;
    matchedHeader: string | null;
    confidence: number;
  }>;
}

export interface TemplateForMatching {
  id: string;
  name: string;
  columns: Array<{
    sourceColumn: string;
    targetField: string;
  }>;
}

export interface SheetForMatching {
  headers: string[];
  columnsProfile?: ColumnProfile[];
}

/**
 * Calculate Jaccard similarity between two sets of normalized strings
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function stringSimilarity(a: string, b: string): number {
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

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - matrix[b.length][a.length] / maxLen;
}

/**
 * Find best matching header for a template column
 */
function findBestHeaderMatch(
  templateColumn: string,
  headers: string[],
  profileMap: Map<string, ColumnProfile>,
): { header: string | null; confidence: number } {
  const normalizedTemplate = normalizeHeader(templateColumn);
  let bestMatch: { header: string | null; confidence: number } = {
    header: null,
    confidence: 0,
  };

  for (const header of headers) {
    const normalizedHeader = normalizeHeader(header);
    let confidence = 0;

    // Exact match
    if (normalizedTemplate === normalizedHeader) {
      confidence = 1.0;
    }
    // Contains match
    else if (
      normalizedHeader.includes(normalizedTemplate) ||
      normalizedTemplate.includes(normalizedHeader)
    ) {
      confidence = 0.8;
    }
    // Fuzzy match
    else {
      const similarity = stringSimilarity(normalizedTemplate, normalizedHeader);
      if (similarity > 0.6) {
        confidence = similarity * 0.7; // Scale down fuzzy matches
      }
    }

    // Boost confidence if column profile suggests compatible type
    const profile = profileMap.get(header.toLowerCase());
    if (profile && confidence > 0) {
      // Small boost for non-empty columns
      if (profile.emptyRate < 50) {
        confidence = Math.min(1.0, confidence + 0.05);
      }
    }

    if (confidence > bestMatch.confidence) {
      bestMatch = { header, confidence };
    }
  }

  return bestMatch;
}

/**
 * Match a single template against a sheet
 */
export function matchTemplateToSheet(
  template: TemplateForMatching,
  sheet: SheetForMatching,
): TemplateMatchResult {
  // Build profile lookup
  const profileMap = new Map<string, ColumnProfile>();
  if (sheet.columnsProfile) {
    for (const profile of sheet.columnsProfile) {
      profileMap.set(profile.headerRaw.toLowerCase(), profile);
    }
  }

  const matchDetails: TemplateMatchResult['matchDetails'] = [];
  let totalConfidence = 0;
  let matchedColumns = 0;

  // Match each template column to sheet headers
  for (const col of template.columns) {
    const match = findBestHeaderMatch(col.sourceColumn, sheet.headers, profileMap);
    matchDetails.push({
      sourceColumn: col.sourceColumn,
      matchedHeader: match.header,
      confidence: match.confidence,
    });

    if (match.header && match.confidence > 0.5) {
      matchedColumns++;
      totalConfidence += match.confidence;
    }
  }

  // Calculate overall template confidence
  const columnMatchRate = template.columns.length > 0
    ? matchedColumns / template.columns.length
    : 0;

  // Also factor in header coverage (how many sheet headers are used)
  const normalizedSheetHeaders = new Set(sheet.headers.map((h) => normalizeHeader(h)));
  const normalizedTemplateColumns = new Set(template.columns.map((c) => normalizeHeader(c.sourceColumn)));
  const headerCoverage = jaccardSimilarity(normalizedTemplateColumns, normalizedSheetHeaders);

  // Final confidence: weighted average of column match rate and avg confidence
  const avgConfidence = matchedColumns > 0 ? totalConfidence / matchedColumns : 0;
  const confidence = columnMatchRate * 0.5 + avgConfidence * 0.3 + headerCoverage * 0.2;

  return {
    templateId: template.id,
    templateName: template.name,
    confidence,
    matchedColumns,
    totalTemplateColumns: template.columns.length,
    totalSheetColumns: sheet.headers.length,
    matchDetails,
  };
}

/**
 * Find best matching templates for a sheet, sorted by confidence
 */
export function findMatchingTemplates(
  templates: TemplateForMatching[],
  sheet: SheetForMatching,
  minConfidence: number = 0.3,
): TemplateMatchResult[] {
  const results: TemplateMatchResult[] = [];

  for (const template of templates) {
    const match = matchTemplateToSheet(template, sheet);
    if (match.confidence >= minConfidence) {
      results.push(match);
    }
  }

  // Sort by confidence descending
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get best template if confidence meets threshold, else null
 */
export function getBestTemplate(
  templates: TemplateForMatching[],
  sheet: SheetForMatching,
  autoApplyThreshold: number = 0.7,
): TemplateMatchResult | null {
  const matches = findMatchingTemplates(templates, sheet);
  if (matches.length > 0 && matches[0].confidence >= autoApplyThreshold) {
    return matches[0];
  }
  return null;
}
