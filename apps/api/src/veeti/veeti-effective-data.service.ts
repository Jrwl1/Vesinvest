import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { VeetiDataType } from './veeti.service';
import {
  getStaticSnapshotYearForDataType,
  VEETI_IMPORT_DATA_TYPES,
} from './veeti-import-contract';

const VEETI_DATA_TYPES: VeetiDataType[] = [...VEETI_IMPORT_DATA_TYPES];

type YearSourceStatus = 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
type SyncRequirement = 'financials' | 'prices' | 'volumes';
type YearWarningCode =
  | 'missing_financials'
  | 'missing_prices'
  | 'missing_volumes'
  | 'fallback_zero_used';

type OverrideMeta = {
  editedAt: Date;
  editedBy: string | null;
  reason: string | null;
  provenance: OverrideProvenance | null;
};

type OverrideProvenance = {
  kind:
    | 'manual_edit'
    | 'statement_import'
    | 'qdis_import'
    | 'kva_import'
    | 'excel_import';
  fileName: string | null;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number | null;
  matchedFields: string[];
  warnings: string[];
  sheetName?: string | null;
  matchedYears?: number[];
  confirmedSourceFields?: string[];
  candidateRows?: Array<{
    sourceField: string;
    workbookValue: number | null;
    action: 'keep_veeti' | 'apply_workbook';
  }>;
};

type EffectiveRowsResult = {
  rows: Array<Record<string, unknown>>;
  source: 'veeti' | 'manual' | 'none';
  hasRawSnapshot: boolean;
  hasOverride: boolean;
  overrideMeta: OverrideMeta | null;
};

type EffectiveYearInfo = {
  vuosi: number;
  dataTypes: string[];
  datasetCounts: Record<VeetiDataType, number>;
  completeness: {
    tilinpaatos: boolean;
    taksa: boolean;
    volume_vesi: boolean;
    volume_jatevesi: boolean;
    investointi: boolean;
    energia: boolean;
    verkko: boolean;
  };
  sourceStatus: YearSourceStatus;
  missingRequirements: SyncRequirement[];
  warnings: YearWarningCode[];
  sourceBreakdown: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  manualEditedAt: string | null;
  manualEditedBy: string | null;
  manualReason: string | null;
  manualProvenance: OverrideProvenance | null;
};

@Injectable()
export class VeetiEffectiveDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getLink(orgId: string) {
    return this.prisma.veetiOrganisaatio.findUnique({ where: { orgId } });
  }

  async requireLink(orgId: string) {
    const link = await this.getLink(orgId);
    if (!link) {
      throw new BadRequestException(
        'Organization is not linked to VEETI. Connect first.',
      );
    }
    return link;
  }

  async getExcludedYears(orgId: string): Promise<number[]> {
    const link = await this.getLink(orgId);
    if (!link) return [];
    return this.getExcludedYearsForVeetiId(orgId, link.veetiId);
  }

  async getExcludedYearsForVeetiId(
    orgId: string,
    veetiId: number,
  ): Promise<number[]> {
    const rows = await this.prisma.veetiYearPolicy.findMany({
      where: {
        orgId,
        veetiId,
        excluded: true,
      },
      select: { vuosi: true },
      orderBy: { vuosi: 'asc' },
    });

    const years = new Set<number>();
    for (const row of rows) {
      const year = Math.round(Number(row.vuosi));
      if (Number.isFinite(year) && year > 0) {
        years.add(year);
      }
    }

    return [...years].sort((a, b) => a - b);
  }

  async getAvailableYears(orgId: string): Promise<EffectiveYearInfo[]> {
    const link = await this.getLink(orgId);
    if (!link) return [];

    const [snapshots, overrides, excludedYears] = await Promise.all([
      this.prisma.veetiSnapshot.findMany({
        where: { orgId, veetiId: link.veetiId },
        select: { vuosi: true, dataType: true, rawData: true },
        orderBy: [{ vuosi: 'asc' }, { fetchedAt: 'desc' }],
      }),
      this.prisma.veetiOverride.findMany({
        where: { orgId, veetiId: link.veetiId },
        select: {
          vuosi: true,
          dataType: true,
          overrideData: true,
          editedAt: true,
          editedBy: true,
          reason: true,
        },
        orderBy: [{ vuosi: 'asc' }, { editedAt: 'desc' }],
      }),
      this.getExcludedYearsForVeetiId(orgId, link.veetiId),
    ]);

    const excludedYearSet = new Set(excludedYears);

    const keyOf = (vuosi: number, dataType: string) => `${vuosi}:${dataType}`;

    const snapshotByKey = new Map<string, { rowCount: number }>();
    for (const row of snapshots) {
      snapshotByKey.set(keyOf(row.vuosi, row.dataType), {
        rowCount: this.readRows(row.rawData).length,
      });
    }

    const overrideByKey = new Map<
      string,
      { rowCount: number; meta: OverrideMeta }
    >();
    for (const row of overrides) {
      overrideByKey.set(keyOf(row.vuosi, row.dataType), {
        rowCount: this.readRows(row.overrideData).length,
        meta: {
          editedAt: row.editedAt,
          editedBy: row.editedBy ?? null,
          reason: row.reason ?? null,
          provenance: this.parseOverrideProvenance(row.overrideData),
        },
      });
    }

    const years = new Set<number>();
    for (const row of snapshots) {
      if (row.vuosi > 0 && !excludedYearSet.has(row.vuosi))
        years.add(row.vuosi);
    }
    for (const row of overrides) {
      if (row.vuosi > 0 && !excludedYearSet.has(row.vuosi))
        years.add(row.vuosi);
    }

    const out: EffectiveYearInfo[] = [];
    for (const year of [...years].sort((a, b) => a - b)) {
      const veetiTypes = new Set<string>();
      const manualTypes = new Set<string>();
      const mergedTypes = new Set<string>();
      const manualMetaCandidates: OverrideMeta[] = [];
      const datasetCounts = {} as Record<VeetiDataType, number>;

      for (const dataType of VEETI_DATA_TYPES) {
        const primaryKey = keyOf(year, dataType);
        const primarySnapshot = snapshotByKey.get(primaryKey);
        const primaryOverride = overrideByKey.get(primaryKey);
        const staticYear = getStaticSnapshotYearForDataType(dataType);
        const staticKey =
          staticYear != null ? keyOf(staticYear, dataType) : undefined;
        const staticSnapshot = staticKey
          ? snapshotByKey.get(staticKey)
          : undefined;
        const staticOverride = staticKey
          ? overrideByKey.get(staticKey)
          : undefined;

        let rowCount = 0;

        if (primaryOverride) {
          rowCount = primaryOverride.rowCount;
          manualTypes.add(dataType);
          manualMetaCandidates.push(primaryOverride.meta);
        } else if (primarySnapshot && primarySnapshot.rowCount > 0) {
          rowCount = primarySnapshot.rowCount;
          veetiTypes.add(dataType);
        } else if (staticOverride) {
          rowCount = staticOverride.rowCount;
          manualTypes.add(dataType);
          manualMetaCandidates.push(staticOverride.meta);
        } else if (staticSnapshot && staticSnapshot.rowCount > 0) {
          rowCount = staticSnapshot.rowCount;
          veetiTypes.add(dataType);
        }

        datasetCounts[dataType] = rowCount;
        if (rowCount > 0) {
          mergedTypes.add(dataType);
        }
      }

      const completeness = this.resolveCompleteness(mergedTypes);
      const missingRequirements = this.resolveMissingRequirements(completeness);
      const warnings = this.resolveYearWarnings(missingRequirements);
      const sourceStatus = this.resolveSourceStatus(
        completeness,
        veetiTypes,
        manualTypes,
      );
      const manualMeta =
        manualMetaCandidates.length === 0
          ? null
          : [...manualMetaCandidates].sort(
              (a, b) => b.editedAt.getTime() - a.editedAt.getTime(),
            )[0];

      out.push({
        vuosi: year,
        dataTypes: [...mergedTypes].sort(),
        datasetCounts,
        completeness,
        sourceStatus,
        missingRequirements,
        warnings,
        sourceBreakdown: {
          veetiDataTypes: [...veetiTypes].sort(),
          manualDataTypes: [...manualTypes].sort(),
        },
        manualEditedAt: manualMeta?.editedAt.toISOString() ?? null,
        manualEditedBy: manualMeta?.editedBy ?? null,
        manualReason: manualMeta?.reason ?? null,
        manualProvenance: manualMeta?.provenance ?? null,
      });
    }

    return out;
  }

  async getEffectiveRows(
    orgId: string,
    vuosi: number,
    dataType: VeetiDataType,
  ): Promise<EffectiveRowsResult> {
    const link = await this.getLink(orgId);
    if (!link) {
      return {
        rows: [],
        source: 'none',
        hasRawSnapshot: false,
        hasOverride: false,
        overrideMeta: null,
      };
    }

    return this.getEffectiveRowsForVeetiId(
      orgId,
      link.veetiId,
      vuosi,
      dataType,
    );
  }

  async getEffectiveRowsForVeetiId(
    orgId: string,
    veetiId: number,
    vuosi: number,
    dataType: VeetiDataType,
  ): Promise<EffectiveRowsResult> {
    const staticYear = getStaticSnapshotYearForDataType(dataType);
    const lookupYears =
      staticYear != null && staticYear !== vuosi
        ? [vuosi, staticYear]
        : [vuosi];

    const [rawSnapshots, overrides] = await Promise.all([
      this.prisma.veetiSnapshot.findMany({
        where: {
          orgId,
          veetiId,
          vuosi: { in: lookupYears },
          dataType,
        },
        select: { vuosi: true, rawData: true },
        orderBy: { fetchedAt: 'desc' },
      }),
      this.prisma.veetiOverride.findMany({
        where: {
          orgId,
          veetiId,
          vuosi: { in: lookupYears },
          dataType,
        },
        select: {
          vuosi: true,
          overrideData: true,
          editedAt: true,
          editedBy: true,
          reason: true,
        },
        orderBy: { editedAt: 'desc' },
      }),
    ]);

    const rawByYear = new Map<number, Prisma.JsonValue | undefined>();
    for (const row of rawSnapshots) {
      if (!rawByYear.has(row.vuosi)) {
        rawByYear.set(row.vuosi, row.rawData);
      }
    }

    const overrideByYear = new Map<
      number,
      {
        overrideData: Prisma.JsonValue;
        editedAt: Date;
        editedBy: string | null;
        reason: string | null;
        provenance: OverrideProvenance | null;
      }
    >();
    for (const row of overrides) {
      if (!overrideByYear.has(row.vuosi)) {
        overrideByYear.set(row.vuosi, {
          ...row,
          provenance: this.parseOverrideProvenance(row.overrideData),
        });
      }
    }

    const override =
      overrideByYear.get(vuosi) ??
      (staticYear != null ? overrideByYear.get(staticYear) : undefined);
    const rawSnapshot =
      rawByYear.get(vuosi) ??
      (staticYear != null ? rawByYear.get(staticYear) : undefined);

    const rawRows = this.readRows(rawSnapshot);
    const overrideRows = this.readRows(override?.overrideData);

    if (overrideRows.length > 0 || override != null) {
      return {
        rows: overrideRows,
        source: 'manual',
        hasRawSnapshot: rawRows.length > 0,
        hasOverride: true,
        overrideMeta: override
          ? {
              editedAt: override.editedAt,
              editedBy: override.editedBy,
              reason: override.reason,
              provenance: override.provenance,
            }
          : null,
      };
    }

    if (rawRows.length > 0) {
      return {
        rows: rawRows,
        source: 'veeti',
        hasRawSnapshot: true,
        hasOverride: false,
        overrideMeta: null,
      };
    }

    return {
      rows: [],
      source: 'none',
      hasRawSnapshot: false,
      hasOverride: false,
      overrideMeta: null,
    };
  }

  async getYearDataset(orgId: string, vuosi: number) {
    const link = await this.requireLink(orgId);
    const data = await Promise.all(
      VEETI_DATA_TYPES.map(async (dataType) => {
        const [rawRows, effective] = await Promise.all([
          this.getRawRowsForYearWithFallback(
            orgId,
            link.veetiId,
            vuosi,
            dataType,
          ),
          this.getEffectiveRowsForVeetiId(orgId, link.veetiId, vuosi, dataType),
        ]);
        const reconcileNeeded =
          effective.hasOverride &&
          rawRows.length > 0 &&
          JSON.stringify(rawRows) !== JSON.stringify(effective.rows);

        return {
          dataType,
          rawRows,
          effectiveRows: effective.rows,
          source: effective.source,
          hasOverride: effective.hasOverride,
          reconcileNeeded,
          overrideMeta: effective.overrideMeta
            ? {
                editedAt: effective.overrideMeta.editedAt.toISOString(),
                editedBy: effective.overrideMeta.editedBy,
                reason: effective.overrideMeta.reason,
                provenance: effective.overrideMeta.provenance,
              }
            : null,
        };
      }),
    );

    const rowSet = new Set<string>();
    for (const row of data) {
      if (row.effectiveRows.length > 0) rowSet.add(row.dataType);
    }

    const completeness = this.resolveCompleteness(rowSet);
    const hasManual = data.some((row) => row.source === 'manual');
    const hasVeeti = data.some((row) => row.source === 'veeti');
    const sourceStatus = this.resolveSourceStatus(
      completeness,
      new Set(
        data.filter((row) => row.source === 'veeti').map((row) => row.dataType),
      ),
      new Set(
        data
          .filter((row) => row.source === 'manual')
          .map((row) => row.dataType),
      ),
    );

    return {
      year: vuosi,
      veetiId: link.veetiId,
      sourceStatus,
      completeness,
      hasManualOverrides: hasManual,
      hasVeetiData: hasVeeti,
      datasets: data,
    };
  }

  async upsertOverride(params: {
    orgId: string;
    veetiId: number;
    vuosi: number;
    dataType: VeetiDataType;
    rows: Array<Record<string, unknown>>;
    editedBy?: string | null;
    reason?: string | null;
  }) {
    return this.prisma.veetiOverride.upsert({
      where: {
        orgId_veetiId_vuosi_dataType: {
          orgId: params.orgId,
          veetiId: params.veetiId,
          vuosi: params.vuosi,
          dataType: params.dataType,
        },
      },
      create: {
        orgId: params.orgId,
        veetiId: params.veetiId,
        vuosi: params.vuosi,
        dataType: params.dataType,
        overrideData: params.rows as unknown as Prisma.InputJsonValue,
        editedBy: params.editedBy ?? null,
        reason: params.reason ?? null,
        editedAt: new Date(),
      },
      update: {
        overrideData: params.rows as unknown as Prisma.InputJsonValue,
        editedBy: params.editedBy ?? null,
        reason: params.reason ?? null,
        editedAt: new Date(),
      },
    });
  }

  async removeOverrides(
    orgId: string,
    veetiId: number,
    vuosi: number,
    dataTypes: VeetiDataType[],
  ) {
    return this.prisma.veetiOverride.deleteMany({
      where: {
        orgId,
        veetiId,
        vuosi,
        dataType: { in: dataTypes },
      },
    });
  }

  private resolveMissingRequirements(completeness: {
    tilinpaatos: boolean;
    taksa: boolean;
    volume_vesi: boolean;
    volume_jatevesi: boolean;
  }): SyncRequirement[] {
    const missing: SyncRequirement[] = [];
    if (!completeness.tilinpaatos) missing.push('financials');
    if (!completeness.taksa) missing.push('prices');
    if (!completeness.volume_vesi && !completeness.volume_jatevesi) {
      missing.push('volumes');
    }
    return missing;
  }

  private resolveYearWarnings(
    missingRequirements: SyncRequirement[],
  ): YearWarningCode[] {
    const warnings: YearWarningCode[] = [];
    if (missingRequirements.includes('financials')) {
      warnings.push('missing_financials');
    }
    if (missingRequirements.includes('prices')) {
      warnings.push('missing_prices');
    }
    if (missingRequirements.includes('volumes')) {
      warnings.push('missing_volumes');
    }
    if (missingRequirements.length > 0) {
      warnings.push('fallback_zero_used');
    }
    return warnings;
  }

  private async getRawRowsForYearWithFallback(
    orgId: string,
    veetiId: number,
    vuosi: number,
    dataType: VeetiDataType,
  ): Promise<Array<Record<string, unknown>>> {
    const staticYear = getStaticSnapshotYearForDataType(dataType);
    const lookupYears =
      staticYear != null && staticYear !== vuosi
        ? [vuosi, staticYear]
        : [vuosi];

    const snapshots = await this.prisma.veetiSnapshot.findMany({
      where: {
        orgId,
        veetiId,
        vuosi: { in: lookupYears },
        dataType,
      },
      select: { vuosi: true, rawData: true },
      orderBy: { fetchedAt: 'desc' },
    });

    const rowsByYear = new Map<number, Array<Record<string, unknown>>>();
    for (const row of snapshots) {
      if (!rowsByYear.has(row.vuosi)) {
        rowsByYear.set(row.vuosi, this.readRows(row.rawData));
      }
    }

    return (
      rowsByYear.get(vuosi) ??
      (staticYear != null ? rowsByYear.get(staticYear) : undefined) ??
      []
    );
  }

  private resolveCompleteness(dataTypes: Set<string>) {
    return {
      tilinpaatos: dataTypes.has('tilinpaatos'),
      taksa: dataTypes.has('taksa'),
      volume_vesi: dataTypes.has('volume_vesi'),
      volume_jatevesi: dataTypes.has('volume_jatevesi'),
      investointi: dataTypes.has('investointi'),
      energia: dataTypes.has('energia'),
      verkko: dataTypes.has('verkko'),
    };
  }

  private resolveSourceStatus(
    completeness: {
      tilinpaatos: boolean;
      taksa: boolean;
      volume_vesi: boolean;
      volume_jatevesi: boolean;
    },
    veetiTypes: Set<string>,
    manualTypes: Set<string>,
  ): YearSourceStatus {
    const missingRequired =
      !completeness.tilinpaatos ||
      !completeness.taksa ||
      (!completeness.volume_vesi && !completeness.volume_jatevesi);
    if (missingRequired) return 'INCOMPLETE';
    if (manualTypes.size === 0) return 'VEETI';
    if (veetiTypes.size === 0) return 'MANUAL';
    return 'MIXED';
  }

  private readRows(
    raw: Prisma.JsonValue | undefined,
  ): Array<Record<string, unknown>> {
    if (!Array.isArray(raw)) return [];
    const out: Array<Record<string, unknown>> = [];
    for (const row of raw) {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        out.push(row as Record<string, unknown>);
      }
    }
    return out;
  }

  private parseOverrideProvenance(
    raw: Prisma.JsonValue | undefined,
  ): OverrideProvenance | null {
    const sourceMeta = this.readSourceMeta(raw);
    if (!sourceMeta) return null;

    const provenanceRaw = sourceMeta.provenance;
    if (
      !provenanceRaw ||
      typeof provenanceRaw !== 'object' ||
      Array.isArray(provenanceRaw)
    ) {
      return null;
    }

    const provenance = provenanceRaw as Record<string, unknown>;
    const kind =
      provenance.kind === 'statement_import'
        ? 'statement_import'
        : provenance.kind === 'qdis_import'
        ? 'qdis_import'
        : provenance.kind === 'kva_import'
        ? 'kva_import'
        : provenance.kind === 'excel_import'
        ? 'excel_import'
        : provenance.kind === 'manual_edit'
        ? 'manual_edit'
        : null;
    if (!kind) return null;

    const matchedFields = Array.isArray(provenance.matchedFields)
      ? provenance.matchedFields
          .map((item) => String(item ?? '').trim())
          .filter((item) => item.length > 0)
      : [];
    const warnings = Array.isArray(provenance.warnings)
      ? provenance.warnings
          .map((item) => String(item ?? '').trim())
          .filter((item) => item.length > 0)
      : [];
    const matchedYears = Array.isArray(provenance.matchedYears)
      ? provenance.matchedYears
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item))
          .map((item) => Math.round(item))
      : [];
    const confirmedSourceFields = Array.isArray(provenance.confirmedSourceFields)
      ? provenance.confirmedSourceFields
          .map((item) => String(item ?? '').trim())
          .filter((item) => item.length > 0)
      : [];
    const candidateRows = Array.isArray(provenance.candidateRows)
      ? provenance.candidateRows
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
              return null;
            }
            const candidate = item as Record<string, unknown>;
            const sourceField = String(candidate.sourceField ?? '').trim();
            const action =
              candidate.action === 'keep_veeti' ||
              candidate.action === 'apply_workbook'
                ? candidate.action
                : null;
            if (!sourceField || action == null) {
              return null;
            }
            return {
              sourceField,
              workbookValue: this.readFiniteNumber(candidate.workbookValue),
              action,
            };
          })
          .filter(
            (
              item,
            ): item is {
              sourceField: string;
              workbookValue: number | null;
              action: 'keep_veeti' | 'apply_workbook';
            } => item !== null,
          )
      : [];

    return {
      kind,
      fileName:
        typeof provenance.fileName === 'string' &&
        provenance.fileName.trim().length > 0
          ? provenance.fileName.trim()
          : null,
      pageNumber: this.readFiniteNumber(provenance.pageNumber),
      confidence: this.readFiniteNumber(provenance.confidence),
      scannedPageCount: this.readFiniteNumber(provenance.scannedPageCount),
      matchedFields,
      warnings,
      sheetName:
        typeof provenance.sheetName === 'string' &&
        provenance.sheetName.trim().length > 0
          ? provenance.sheetName.trim()
          : null,
      matchedYears,
      confirmedSourceFields,
      candidateRows,
    };
  }

  private readSourceMeta(
    raw: Prisma.JsonValue | undefined,
  ): Record<string, unknown> | null {
    for (const row of this.readRows(raw)) {
      const candidate = row.__sourceMeta;
      if (
        candidate &&
        typeof candidate === 'object' &&
        !Array.isArray(candidate)
      ) {
        return candidate as Record<string, unknown>;
      }
    }
    return null;
  }

  private readFiniteNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}

export type {
  EffectiveYearInfo,
  EffectiveRowsResult,
  OverrideMeta,
  OverrideProvenance,
  YearSourceStatus,
};
