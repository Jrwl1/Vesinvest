/**
 * Post-Import Sanity Summary Service
 * 
 * Provides aggregated, read-only data to help users visually validate
 * imported data and build trust in the system.
 * 
 * Design principles:
 * - Pre-aggregate via Prisma groupBy where possible
 * - Compute derived values in service layer
 * - Never throw user-visible errors
 * - Work for demo mode and large imports
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImportsRepository } from './imports.repository';

export interface AssetCountByType {
  assetTypeId: string;
  assetTypeName: string;
  assetTypeCode: string;
  count: number;
}

export interface AssetCountBySite {
  siteId: string;
  siteName: string;
  count: number;
}

export interface AssetCountByDecade {
  decade: string; // e.g., "1960s", "1970s", "Unknown"
  count: number;
}

export interface CostDistribution {
  min: number | null;
  max: number | null;
  median: number | null;
  average: number | null;
  p90: number | null;
  p95: number | null;
  totalAssets: number;
  assetsWithCost: number;
}

export interface AgeLifetimeData {
  /** Assets past their expected lifetime */
  overdueCount: number;
  /** Assets within 3 years of end of life */
  upcomingCount: number;
  /** Assets with remaining life > 3 years */
  okCount: number;
  /** Assets without enough data to calculate */
  unknownCount: number;
  /** Average age in years */
  averageAge: number | null;
  /** Average expected lifetime */
  averageLifeYears: number | null;
  /** Distribution of age vs lifetime ratio */
  ageDistribution: Array<{
    bucket: string; // "0-25%", "25-50%", "50-75%", "75-100%", "100%+"
    count: number;
  }>;
}

export interface SanitySummary {
  importId: string;
  importFilename: string;
  importedAt: string;
  totalAssetsImported: number;
  /** Counts by asset type */
  byAssetType: AssetCountByType[];
  /** Counts by site */
  bySite: AssetCountBySite[];
  /** Counts by installation decade */
  byDecade: AssetCountByDecade[];
  /** Replacement cost statistics */
  costDistribution: CostDistribution;
  /** Age vs lifetime analysis */
  ageLifetime: AgeLifetimeData;
  /** Any issues detected */
  dataQualityNotes: string[];
}

@Injectable()
export class SanitySummaryService {
  private readonly logger = new Logger(SanitySummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importsRepo: ImportsRepository,
  ) {}

  /**
   * Generate a sanity summary for an import.
   * This is designed to never throw - returns empty/partial data on errors.
   */
  async getSanitySummary(orgId: string, importId: string): Promise<SanitySummary | null> {
    try {
      // Load import metadata
      const importRecord = await this.importsRepo.findById(orgId, importId);
      if (!importRecord) {
        this.logger.warn(`Import ${importId} not found for sanity summary`);
        return null;
      }

      // Get all assets from this import
      const assets = await this.prisma.asset.findMany({
        where: {
          orgId,
          sourceImportId: importId,
        },
        include: {
          assetType: true,
          site: true,
        },
      });

      if (assets.length === 0) {
        // Valid case: import may have updated existing assets without creating new ones
        return this.buildEmptySummary(importId, importRecord.filename, importRecord.uploadedAt);
      }

      const currentYear = new Date().getFullYear();
      const dataQualityNotes: string[] = [];

      // Aggregate by asset type
      const byAssetType = this.aggregateByAssetType(assets);

      // Aggregate by site
      const bySite = this.aggregateBySite(assets);

      // Aggregate by decade
      const byDecade = this.aggregateByDecade(assets);

      // Calculate cost distribution
      const costDistribution = this.calculateCostDistribution(assets);

      // Calculate age vs lifetime data
      const ageLifetime = this.calculateAgeLifetime(assets, currentYear);

      // Add data quality notes
      if (costDistribution.assetsWithCost < assets.length * 0.5) {
        dataQualityNotes.push(
          `${assets.length - costDistribution.assetsWithCost} assets are missing replacement cost data.`
        );
      }

      if (ageLifetime.unknownCount > assets.length * 0.2) {
        dataQualityNotes.push(
          `${ageLifetime.unknownCount} assets are missing installation date or lifetime data.`
        );
      }

      if (ageLifetime.overdueCount > 0) {
        dataQualityNotes.push(
          `${ageLifetime.overdueCount} assets are past their expected replacement date.`
        );
      }

      const missingExternalRef = assets.filter(a => a.derivedIdentity).length;
      if (missingExternalRef > 0) {
        dataQualityNotes.push(
          `${missingExternalRef} assets have auto-generated identifiers (should be updated with real IDs).`
        );
      }

      return {
        importId,
        importFilename: importRecord.filename,
        importedAt: importRecord.uploadedAt.toISOString(),
        totalAssetsImported: assets.length,
        byAssetType,
        bySite,
        byDecade,
        costDistribution,
        ageLifetime,
        dataQualityNotes,
      };
    } catch (err) {
      this.logger.error(`Failed to generate sanity summary for import ${importId}:`, err);
      // Return null rather than throwing - UI should handle gracefully
      return null;
    }
  }

  private buildEmptySummary(
    importId: string,
    filename: string,
    uploadedAt: Date
  ): SanitySummary {
    return {
      importId,
      importFilename: filename,
      importedAt: uploadedAt.toISOString(),
      totalAssetsImported: 0,
      byAssetType: [],
      bySite: [],
      byDecade: [],
      costDistribution: {
        min: null,
        max: null,
        median: null,
        average: null,
        p90: null,
        p95: null,
        totalAssets: 0,
        assetsWithCost: 0,
      },
      ageLifetime: {
        overdueCount: 0,
        upcomingCount: 0,
        okCount: 0,
        unknownCount: 0,
        averageAge: null,
        averageLifeYears: null,
        ageDistribution: [],
      },
      dataQualityNotes: ['No new assets were created in this import.'],
    };
  }

  private aggregateByAssetType(
    assets: Array<{ assetType: { id: string; name: string; code: string } }>
  ): AssetCountByType[] {
    const counts = new Map<string, { name: string; code: string; count: number }>();

    for (const asset of assets) {
      const existing = counts.get(asset.assetType.id);
      if (existing) {
        existing.count++;
      } else {
        counts.set(asset.assetType.id, {
          name: asset.assetType.name,
          code: asset.assetType.code,
          count: 1,
        });
      }
    }

    return Array.from(counts.entries())
      .map(([id, data]) => ({
        assetTypeId: id,
        assetTypeName: data.name,
        assetTypeCode: data.code,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private aggregateBySite(
    assets: Array<{ site: { id: string; name: string } }>
  ): AssetCountBySite[] {
    const counts = new Map<string, { name: string; count: number }>();

    for (const asset of assets) {
      const existing = counts.get(asset.site.id);
      if (existing) {
        existing.count++;
      } else {
        counts.set(asset.site.id, {
          name: asset.site.name,
          count: 1,
        });
      }
    }

    return Array.from(counts.entries())
      .map(([id, data]) => ({
        siteId: id,
        siteName: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private aggregateByDecade(
    assets: Array<{ installedOn: Date | null }>
  ): AssetCountByDecade[] {
    const counts = new Map<string, number>();

    for (const asset of assets) {
      let decade: string;
      if (!asset.installedOn) {
        decade = 'Unknown';
      } else {
        const year = asset.installedOn.getFullYear();
        const decadeStart = Math.floor(year / 10) * 10;
        decade = `${decadeStart}s`;
      }

      counts.set(decade, (counts.get(decade) || 0) + 1);
    }

    // Sort by decade (Unknown last)
    return Array.from(counts.entries())
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => {
        if (a.decade === 'Unknown') return 1;
        if (b.decade === 'Unknown') return -1;
        return a.decade.localeCompare(b.decade);
      });
  }

  private calculateCostDistribution(
    assets: Array<{ replacementCostEur: { toNumber(): number } | null }>
  ): CostDistribution {
    const costs = assets
      .filter((a) => a.replacementCostEur !== null)
      .map((a) => a.replacementCostEur!.toNumber())
      .sort((a, b) => a - b);

    if (costs.length === 0) {
      return {
        min: null,
        max: null,
        median: null,
        average: null,
        p90: null,
        p95: null,
        totalAssets: assets.length,
        assetsWithCost: 0,
      };
    }

    const sum = costs.reduce((acc, c) => acc + c, 0);
    const average = sum / costs.length;

    return {
      min: costs[0],
      max: costs[costs.length - 1],
      median: this.percentile(costs, 50),
      average: Math.round(average * 100) / 100,
      p90: this.percentile(costs, 90),
      p95: this.percentile(costs, 95),
      totalAssets: assets.length,
      assetsWithCost: costs.length,
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = (p / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedArray[lower];
    return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
  }

  private calculateAgeLifetime(
    assets: Array<{ installedOn: Date | null; lifeYears: number | null }>,
    currentYear: number
  ): AgeLifetimeData {
    let overdueCount = 0;
    let upcomingCount = 0;
    let okCount = 0;
    let unknownCount = 0;
    const ages: number[] = [];
    const lifeYears: number[] = [];
    const ratios: number[] = [];

    for (const asset of assets) {
      if (!asset.installedOn || !asset.lifeYears) {
        unknownCount++;
        continue;
      }

      const installYear = asset.installedOn.getFullYear();
      const age = currentYear - installYear;
      const expectedEndYear = installYear + asset.lifeYears;
      const yearsRemaining = expectedEndYear - currentYear;

      ages.push(age);
      lifeYears.push(asset.lifeYears);

      // Calculate age as percentage of expected life
      const ratio = (age / asset.lifeYears) * 100;
      ratios.push(ratio);

      if (yearsRemaining <= 0) {
        overdueCount++;
      } else if (yearsRemaining <= 3) {
        upcomingCount++;
      } else {
        okCount++;
      }
    }

    // Calculate age distribution buckets
    const buckets = [
      { label: '0-25%', min: 0, max: 25, count: 0 },
      { label: '25-50%', min: 25, max: 50, count: 0 },
      { label: '50-75%', min: 50, max: 75, count: 0 },
      { label: '75-100%', min: 75, max: 100, count: 0 },
      { label: '100%+', min: 100, max: Infinity, count: 0 },
    ];

    for (const ratio of ratios) {
      for (const bucket of buckets) {
        if (ratio >= bucket.min && ratio < bucket.max) {
          bucket.count++;
          break;
        }
        if (bucket.max === Infinity && ratio >= bucket.min) {
          bucket.count++;
          break;
        }
      }
    }

    return {
      overdueCount,
      upcomingCount,
      okCount,
      unknownCount,
      averageAge: ages.length > 0 
        ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 
        : null,
      averageLifeYears: lifeYears.length > 0 
        ? Math.round((lifeYears.reduce((a, b) => a + b, 0) / lifeYears.length) * 10) / 10 
        : null,
      ageDistribution: buckets.map((b) => ({
        bucket: b.label,
        count: b.count,
      })),
    };
  }
}
