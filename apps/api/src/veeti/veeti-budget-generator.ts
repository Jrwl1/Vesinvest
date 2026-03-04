import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VeetiEffectiveDataService } from './veeti-effective-data.service';
import { VeetiService } from './veeti.service';

type ValisummaType =
  | 'tulo'
  | 'kulu'
  | 'poisto'
  | 'rahoitus_tulo'
  | 'rahoitus_kulu'
  | 'investointi'
  | 'tulos';

type MappingEntry = {
  categoryKey: string;
  tyyppi: ValisummaType;
  label_fi: string;
};

const TILINPAATOS_MAPPING: Record<string, MappingEntry> = {
  Liikevaihto: {
    categoryKey: 'liikevaihto',
    tyyppi: 'tulo',
    label_fi: 'Liikevaihto',
  },
  AineetJaPalvelut: {
    categoryKey: 'materials_services',
    tyyppi: 'kulu',
    label_fi: 'Aineet ja palvelut',
  },
  Henkilostokulut: {
    categoryKey: 'personnel_costs',
    tyyppi: 'kulu',
    label_fi: 'Henkilostokulut',
  },
  LiiketoiminnanMuutKulut: {
    categoryKey: 'other_costs',
    tyyppi: 'kulu',
    label_fi: 'Liiketoiminnan muut kulut',
  },
  Poistot: { categoryKey: 'poistot', tyyppi: 'poisto', label_fi: 'Poistot' },
  Arvonalentumiset: {
    categoryKey: 'arvonalentumiset',
    tyyppi: 'poisto',
    label_fi: 'Arvonalentumiset',
  },
  RahoitustuototJaKulut: {
    categoryKey: 'rahoitustuotot_ja_kulut',
    tyyppi: 'rahoitus_tulo',
    label_fi: 'Rahoitustuotot ja -kulut',
  },
  TilikaudenYliJaama: {
    categoryKey: 'tilikauden_tulos',
    tyyppi: 'tulos',
    label_fi: 'Tilikauden ylijäämä/alijäämä',
  },
  Omistajatuloutus: {
    categoryKey: 'omistajatuloutus',
    tyyppi: 'kulu',
    label_fi: 'Omistajatuloutus',
  },
  OmistajanTukiKayttokustannuksiin: {
    categoryKey: 'omistajan_tuki',
    tyyppi: 'tulo',
    label_fi: 'Omistajan tuki käyttökustannuksiin',
  },
};

const VA_COST_FALLBACK_MATERIALS_SHARE = 0.4;

@Injectable()
export class VeetiBudgetGenerator {
  private readonly logger = new Logger(VeetiBudgetGenerator.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly veetiService: VeetiService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
  ) {}

  async previewBudget(orgId: string, vuosi: number) {
    const tilinpaatosRows = await this.getSnapshotRows(
      orgId,
      vuosi,
      'tilinpaatos',
    );
    const taksaRows = await this.getSnapshotRows(orgId, vuosi, 'taksa');
    const waterRows = await this.getSnapshotRows(orgId, vuosi, 'volume_vesi');
    const wastewaterRows = await this.getSnapshotRows(
      orgId,
      vuosi,
      'volume_jatevesi',
    );
    const investointiRows = await this.getSnapshotRows(
      orgId,
      vuosi,
      'investointi',
    );

    if (tilinpaatosRows.length === 0) {
      throw new BadRequestException(
        `No Tilinpaatos snapshot found for year ${vuosi}.`,
      );
    }

    const tilinpaatos = (tilinpaatosRows[0] ?? {}) as Record<string, unknown>;

    const valisummat = this.mapTilinpaatosToValisummat(tilinpaatos, vuosi);
    const { drivers, missingFields: driverMissingFields } = this.buildDrivers(
      taksaRows,
      waterRows,
      wastewaterRows,
    );
    const investmentBaseline = this.computeInvestmentBaseline(investointiRows);
    const financialMissingFields = this.resolveMissingTilinpaatosFields(
      tilinpaatos,
      vuosi,
    );
    const fallbackFields = Array.from(
      new Set([...financialMissingFields, ...driverMissingFields]),
    ).sort();

    const liikevaihto =
      this.veetiService.toNumber(tilinpaatos['Liikevaihto']) ?? 0;
    const hasProjectionDriver = drivers.some(
      (driver) => driver.yksikkohinta > 0 && driver.myytyMaara > 0,
    );

    const completeness = {
      required: {
        liikevaihto: liikevaihto > 0,
        projectionDriver: hasProjectionDriver,
      },
      fieldsMapped: Object.keys(TILINPAATOS_MAPPING).length,
      fieldsPresent: Object.keys(TILINPAATOS_MAPPING).filter(
        (key) => this.veetiService.toNumber(tilinpaatos[key]) != null,
      ).length,
      fallbackToZero: {
        count: fallbackFields.length,
        fields: fallbackFields,
      },
    };

    return {
      vuosi,
      valisummat,
      drivers,
      investmentBaseline,
      completeness,
      missing: {
        liikevaihto: liikevaihto <= 0,
        projectionDriver: !hasProjectionDriver,
      },
      warnings:
        fallbackFields.length > 0
          ? ['Missing source values defaulted to 0 for calculations.']
          : [],
    };
  }

  async generateBudgets(orgId: string, years: number[]) {
    const createdOrUpdated: Array<{
      budgetId: string;
      vuosi: number;
      mode: 'created' | 'updated';
    }> = [];
    const skipped: Array<{ vuosi: number; reason: string }> = [];

    for (const year of years) {
      const preview = await this.previewBudget(orgId, year);
      if (preview.missing.liikevaihto) {
        skipped.push({ vuosi: year, reason: 'Liikevaihto missing or zero.' });
        continue;
      }
      if (preview.missing.projectionDriver) {
        skipped.push({
          vuosi: year,
          reason: 'Required VEETI drivers are missing.',
        });
        continue;
      }

      const existing = await this.prisma.talousarvio.findFirst({
        where: {
          orgId,
          vuosi: year,
          lahde: 'veeti',
        },
        orderBy: { updatedAt: 'desc' },
      });

      const now = new Date();
      let budgetId = existing?.id;
      let mode: 'created' | 'updated' = 'created';

      if (existing && !existing.userEdited) {
        mode = 'updated';
        budgetId = existing.id;
        await this.prisma.talousarvio.update({
          where: { id: existing.id },
          data: {
            lahde: 'veeti',
            veetiVuosi: year,
            veetiImportedAt: now,
            userEdited: false,
            inputCompleteness: preview.completeness as any,
          },
        });
        await this.prisma.talousarvioValisumma.deleteMany({
          where: { talousarvioId: existing.id },
        });
        await this.prisma.tuloajuri.deleteMany({
          where: { talousarvioId: existing.id },
        });
      } else {
        const name = existing?.id
          ? `VEETI ${year} (paivitetty ${now.toLocaleDateString('fi-FI')})`
          : `VEETI ${year}`;
        const budget = await this.prisma.talousarvio.create({
          data: {
            orgId,
            vuosi: year,
            nimi: name,
            tila: 'luonnos',
            lahde: 'veeti',
            veetiVuosi: year,
            veetiImportedAt: now,
            userEdited: false,
            inputCompleteness: preview.completeness as any,
          },
        });
        budgetId = budget.id;
      }

      await this.prisma.talousarvioValisumma.createMany({
        data: preview.valisummat.map((item) => ({
          talousarvioId: budgetId!,
          palvelutyyppi: item.palvelutyyppi,
          categoryKey: item.categoryKey,
          tyyppi: item.tyyppi,
          label: item.label,
          summa: item.summa,
          lahde: 'veeti',
        })),
      });

      await this.prisma.tuloajuri.createMany({
        data: preview.drivers.map((driver) => ({
          talousarvioId: budgetId!,
          palvelutyyppi: driver.palvelutyyppi,
          yksikkohinta: driver.yksikkohinta,
          myytyMaara: driver.myytyMaara,
          sourceMeta: driver.sourceMeta as any,
        })),
      });

      createdOrUpdated.push({ budgetId: budgetId!, vuosi: year, mode });
    }

    return {
      success: true,
      count: createdOrUpdated.length,
      results: createdOrUpdated,
      skipped,
    };
  }

  mapTilinpaatosToValisummat(
    tilinpaatos: Record<string, unknown>,
    vuosi?: number,
  ) {
    const aineetJaPalvelut = this.veetiService.toNumber(
      tilinpaatos['AineetJaPalvelut'],
    );
    const liiketoiminnanMuutKulut = this.veetiService.toNumber(
      tilinpaatos['LiiketoiminnanMuutKulut'],
    );
    const shouldSplitOperatingFallback =
      aineetJaPalvelut == null && liiketoiminnanMuutKulut != null;
    const fallbackMaterialsServices = shouldSplitOperatingFallback
      ? Math.abs(liiketoiminnanMuutKulut ?? 0) *
        VA_COST_FALLBACK_MATERIALS_SHARE
      : 0;
    const fallbackOtherCosts = shouldSplitOperatingFallback
      ? Math.abs(liiketoiminnanMuutKulut ?? 0) - fallbackMaterialsServices
      : 0;

    return Object.entries(TILINPAATOS_MAPPING).map(([field, cfg]) => {
      const amount = this.veetiService.toNumber(tilinpaatos[field]);

      const safeAmount = amount ?? 0;

      let type = cfg.tyyppi;
      if (field === 'RahoitustuototJaKulut' && safeAmount < 0) {
        type = 'rahoitus_kulu';
      }

      let normalizedAmount = safeAmount;
      if (field === 'TilikaudenYliJaama') {
        // Keep result signed so deficit years remain negative.
        normalizedAmount = safeAmount;
      } else if (field === 'RahoitustuototJaKulut') {
        // Positive stays financial income, negative moves to financial cost as magnitude.
        normalizedAmount = Math.abs(safeAmount);
      } else if (
        type === 'kulu' ||
        type === 'poisto' ||
        type === 'rahoitus_kulu' ||
        type === 'investointi'
      ) {
        normalizedAmount = Math.abs(safeAmount);
      }

      if (field === 'AineetJaPalvelut' && shouldSplitOperatingFallback) {
        normalizedAmount = fallbackMaterialsServices;
      }
      if (field === 'LiiketoiminnanMuutKulut' && shouldSplitOperatingFallback) {
        normalizedAmount = fallbackOtherCosts;
      }

      return {
        palvelutyyppi: 'muu' as const,
        categoryKey: cfg.categoryKey,
        tyyppi: type,
        label: cfg.label_fi,
        summa: normalizedAmount,
      };
    });
  }

  private buildDrivers(
    taksaRows: Record<string, unknown>[],
    waterRows: Record<string, unknown>[],
    wastewaterRows: Record<string, unknown>[],
  ) {
    let waterPrice = 0;
    let wastewaterPrice = 0;

    for (const row of taksaRows) {
      const type = this.veetiService.toNumber(row['Tyyppi_Id']);
      const price = this.veetiService.toNumber(row['Kayttomaksu']) ?? 0;
      if (type === 1 && price > 0) waterPrice = price;
      if (type === 2 && price > 0) wastewaterPrice = price;
    }

    const waterVolume = waterRows.reduce(
      (sum, row) => sum + (this.veetiService.toNumber(row['Maara']) ?? 0),
      0,
    );
    const wastewaterVolume = wastewaterRows.reduce(
      (sum, row) => sum + (this.veetiService.toNumber(row['Maara']) ?? 0),
      0,
    );

    const sourceMeta = this.resolveDriverSourceMeta([
      ...taksaRows,
      ...waterRows,
      ...wastewaterRows,
    ]);

    const missingFields: string[] = [];
    const hasWaterPrice = taksaRows.some(
      (row) =>
        this.veetiService.toNumber(row['Tyyppi_Id']) === 1 &&
        this.veetiService.toNumber(row['Kayttomaksu']) != null,
    );
    const hasWastewaterPrice = taksaRows.some(
      (row) =>
        this.veetiService.toNumber(row['Tyyppi_Id']) === 2 &&
        this.veetiService.toNumber(row['Kayttomaksu']) != null,
    );
    const hasWaterVolume = waterRows.some(
      (row) => this.veetiService.toNumber(row['Maara']) != null,
    );
    const hasWastewaterVolume = wastewaterRows.some(
      (row) => this.veetiService.toNumber(row['Maara']) != null,
    );
    if (!hasWaterPrice) missingFields.push('taksa.water.Kayttomaksu');
    if (!hasWastewaterPrice) {
      missingFields.push('taksa.wastewater.Kayttomaksu');
    }
    if (!hasWaterVolume) missingFields.push('volume_vesi.Maara');
    if (!hasWastewaterVolume) {
      missingFields.push('volume_jatevesi.Maara');
    }

    return {
      drivers: [
        {
          palvelutyyppi: 'vesi' as const,
          yksikkohinta: waterPrice,
          myytyMaara: waterVolume,
          sourceMeta,
        },
        {
          palvelutyyppi: 'jatevesi' as const,
          yksikkohinta: wastewaterPrice,
          myytyMaara: wastewaterVolume,
          sourceMeta,
        },
      ],
      missingFields,
    };
  }

  private resolveMissingTilinpaatosFields(
    tilinpaatos: Record<string, unknown>,
    vuosi?: number,
  ): string[] {
    const missing: string[] = [];
    for (const field of Object.keys(TILINPAATOS_MAPPING)) {
      const value = this.veetiService.toNumber(tilinpaatos[field]);
      if (value != null) continue;
      this.logger.warn(
        `VEETI Tilinpaatos missing expected field: ${field} (vuosi=${
          vuosi ?? 'unknown'
        })`,
      );
      missing.push(`tilinpaatos.${field}`);
    }
    return missing;
  }

  private resolveDriverSourceMeta(rows: Record<string, unknown>[]) {
    const fallback = {
      source: 'veeti',
      imported: true,
      manualOverride: false,
    };

    const metaRow = rows.find((row) => {
      const raw = row.__sourceMeta;
      return raw && typeof raw === 'object' && !Array.isArray(raw);
    });
    if (!metaRow) return fallback;

    return {
      ...fallback,
      ...(metaRow.__sourceMeta as Record<string, unknown>),
    };
  }

  private computeInvestmentBaseline(rows: Record<string, unknown>[]) {
    return rows.reduce((sum, row) => {
      const invest = this.veetiService.toNumber(row['InvestoinninMaara']) ?? 0;
      const replacement =
        this.veetiService.toNumber(row['KorvausInvestoinninMaara']) ?? 0;
      return sum + invest + replacement;
    }, 0);
  }

  private async getSnapshotRows(
    orgId: string,
    vuosi: number,
    dataType: string,
  ): Promise<Record<string, unknown>[]> {
    const effective = await this.veetiEffectiveDataService.getEffectiveRows(
      orgId,
      vuosi,
      dataType as any,
    );
    return effective.rows;
  }
}
