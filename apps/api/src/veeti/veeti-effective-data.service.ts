import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { VeetiDataType } from './veeti.service';

const VEETI_DATA_TYPES: VeetiDataType[] = [
  'tilinpaatos',
  'taksa',
  'volume_vesi',
  'volume_jatevesi',
  'investointi',
  'energia',
  'verkko',
];

type YearSourceStatus = 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';

type OverrideMeta = {
  editedAt: Date;
  editedBy: string | null;
  reason: string | null;
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
  sourceBreakdown: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  manualEditedAt: string | null;
  manualEditedBy: string | null;
  manualReason: string | null;
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

  async getAvailableYears(orgId: string): Promise<EffectiveYearInfo[]> {
    const link = await this.getLink(orgId);
    if (!link) return [];

    const [snapshots, overrides] = await Promise.all([
      this.prisma.veetiSnapshot.findMany({
        where: { orgId, veetiId: link.veetiId },
        select: { vuosi: true, dataType: true },
        orderBy: { vuosi: 'asc' },
      }),
      this.prisma.veetiOverride.findMany({
        where: { orgId, veetiId: link.veetiId },
        select: {
          vuosi: true,
          dataType: true,
          editedAt: true,
          editedBy: true,
          reason: true,
        },
        orderBy: [{ vuosi: 'asc' }, { editedAt: 'desc' }],
      }),
    ]);

    const veetiByYear = new Map<number, Set<string>>();
    for (const row of snapshots) {
      const set = veetiByYear.get(row.vuosi) ?? new Set<string>();
      set.add(row.dataType);
      veetiByYear.set(row.vuosi, set);
    }

    const manualByYear = new Map<number, Set<string>>();
    const manualMetaByYear = new Map<number, OverrideMeta>();
    for (const row of overrides) {
      const set = manualByYear.get(row.vuosi) ?? new Set<string>();
      set.add(row.dataType);
      manualByYear.set(row.vuosi, set);

      if (!manualMetaByYear.has(row.vuosi)) {
        manualMetaByYear.set(row.vuosi, {
          editedAt: row.editedAt,
          editedBy: row.editedBy ?? null,
          reason: row.reason ?? null,
        });
      }
    }

    const years = new Set<number>([
      ...veetiByYear.keys(),
      ...manualByYear.keys(),
    ]);

    const out: EffectiveYearInfo[] = [];
    for (const year of [...years].sort((a, b) => a - b)) {
      const veetiTypes = veetiByYear.get(year) ?? new Set<string>();
      const manualTypes = manualByYear.get(year) ?? new Set<string>();
      const mergedTypes = new Set<string>([...veetiTypes, ...manualTypes]);
      const completeness = this.resolveCompleteness(mergedTypes);
      const sourceStatus = this.resolveSourceStatus(
        completeness,
        veetiTypes,
        manualTypes,
      );
      const manualMeta = manualMetaByYear.get(year) ?? null;

      out.push({
        vuosi: year,
        dataTypes: [...mergedTypes].sort(),
        completeness,
        sourceStatus,
        sourceBreakdown: {
          veetiDataTypes: [...veetiTypes].sort(),
          manualDataTypes: [...manualTypes].sort(),
        },
        manualEditedAt: manualMeta?.editedAt.toISOString() ?? null,
        manualEditedBy: manualMeta?.editedBy ?? null,
        manualReason: manualMeta?.reason ?? null,
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
    const [rawSnapshot, override] = await Promise.all([
      this.prisma.veetiSnapshot.findFirst({
        where: { orgId, veetiId, vuosi, dataType },
        select: { rawData: true },
        orderBy: { fetchedAt: 'desc' },
      }),
      this.prisma.veetiOverride.findUnique({
        where: {
          orgId_veetiId_vuosi_dataType: {
            orgId,
            veetiId,
            vuosi,
            dataType,
          },
        },
        select: {
          overrideData: true,
          editedAt: true,
          editedBy: true,
          reason: true,
        },
      }),
    ]);

    const rawRows = this.readRows(rawSnapshot?.rawData);
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
        const [rawSnapshot, effective] = await Promise.all([
          this.prisma.veetiSnapshot.findFirst({
            where: { orgId, veetiId: link.veetiId, vuosi, dataType },
            select: { rawData: true },
            orderBy: { fetchedAt: 'desc' },
          }),
          this.getEffectiveRowsForVeetiId(orgId, link.veetiId, vuosi, dataType),
        ]);

        const rawRows = this.readRows(rawSnapshot?.rawData);
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
}

export type { EffectiveYearInfo, EffectiveRowsResult, YearSourceStatus };
