import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsService } from '../projections/projections.service';
import { VeetiBenchmarkService } from '../veeti/veeti-benchmark.service';
import { VeetiBudgetGenerator } from '../veeti/veeti-budget-generator';
import { VeetiEffectiveDataService } from '../veeti/veeti-effective-data.service';
import { VeetiSanityService } from '../veeti/veeti-sanity.service';
import { VeetiService } from '../veeti/veeti.service';
import { VeetiSyncService } from '../veeti/veeti-sync.service';
import { ManualYearCompletionDto } from './dto/manual-year-completion.dto';
import { ImportYearReconcileDto } from './dto/import-year-reconcile.dto';
import { OpsEventDto } from './dto/ops-event.dto';

type SyncRequirement = 'financials' | 'prices' | 'volumes';

type TrendPoint = {
  year: number;
  revenue: number;
  operatingCosts: number;
  financingNet: number;
  otherResultItems: number;
  yearResult: number;
  costs: number;
  result: number;
  volume: number;
  combinedPrice: number;
};

type ScenarioYear = {
  year: number;
  revenue: number;
  costs: number;
  result: number;
  investments: number;
  combinedPrice: number;
  soldVolume: number;
  cashflow: number;
  cumulativeCashflow: number;
  waterPrice: number;
  wastewaterPrice: number;
};

type ScenarioPayload = {
  id: string;
  name: string;
  onOletus: boolean;
  talousarvioId: string;
  baselineYear: number | null;
  horizonYears: number;
  assumptions: Record<string, number>;
  yearlyInvestments: YearlyInvestment[];
  nearTermExpenseAssumptions: NearTermExpenseAssumption[];
  requiredPriceTodayCombined: number | null;
  baselinePriceTodayCombined: number | null;
  requiredAnnualIncreasePct: number | null;
  years: ScenarioYear[];
  priceSeries: Array<{
    year: number;
    combinedPrice: number;
    waterPrice: number;
    wastewaterPrice: number;
  }>;
  investmentSeries: Array<{ year: number; amount: number }>;
  cashflowSeries: Array<{
    year: number;
    cashflow: number;
    cumulativeCashflow: number;
  }>;
  updatedAt: Date;
  createdAt: Date;
};

type SnapshotPayload = {
  scenario: ScenarioPayload;
  generatedAt: string;
};

type YearlyInvestment = {
  year: number;
  amount: number;
};

type NearTermExpenseAssumption = {
  year: number;
  personnelPct: number;
  energyPct: number;
  opexOtherPct: number;
};

type SnapshotTrendPoint = {
  year: number;
  revenue: number;
  operatingCosts: number;
  financingNet: number;
  otherResultItems: number;
  yearResult: number;
  costs: number;
  result: number;
  volume: number;
  combinedPrice: number;
};

@Injectable()
export class V2Service {
  private readonly logger = new Logger(V2Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionsService: ProjectionsService,
    private readonly veetiService: VeetiService,
    private readonly veetiSyncService: VeetiSyncService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
    private readonly veetiBudgetGenerator: VeetiBudgetGenerator,
    private readonly veetiBenchmarkService: VeetiBenchmarkService,
    private readonly veetiSanityService: VeetiSanityService,
  ) {}

  async searchOrganizations(query: string, limit: number) {
    const safeLimit = Math.max(
      1,
      Math.min(50, Number.isFinite(limit) ? limit : 20),
    );
    return this.veetiService.searchOrganizations(query, safeLimit);
  }

  async connectOrganization(orgId: string, veetiId: number) {
    return this.veetiSyncService.connectOrg(orgId, veetiId);
  }

  async syncImport(orgId: string, years: number[]) {
    const sync = await this.veetiSyncService.refreshOrg(orgId);
    const yearRows = await this.veetiSyncService.getAvailableYears(orgId);
    const yearRowByYear = new Map(yearRows.map((row) => [row.vuosi, row]));
    const requestedYears = this.normalizeYears(years);
    const defaultYears = [...yearRows]
      .filter((row) => this.resolveSyncBlockReason(row.completeness) === null)
      .sort((a, b) => b.vuosi - a.vuosi)
      .slice(0, 3)
      .map((row) => row.vuosi);
    const selectedYears =
      requestedYears.length > 0 ? requestedYears : defaultYears;

    const preSkipped: Array<{ vuosi: number; reason: string }> = [];
    const eligibleYears: number[] = [];

    for (const year of selectedYears) {
      const row = yearRowByYear.get(year);
      if (!row) {
        preSkipped.push({
          vuosi: year,
          reason:
            'Year is not available in imported VEETI data. Refresh import first.',
        });
        continue;
      }

      const blockedReason = this.resolveSyncBlockReason(row.completeness);
      if (blockedReason) {
        preSkipped.push({ vuosi: year, reason: blockedReason });
        continue;
      }

      eligibleYears.push(year);
    }

    const generatedBudgets =
      eligibleYears.length > 0
        ? await this.veetiBudgetGenerator.generateBudgets(orgId, eligibleYears)
        : {
            success: true,
            count: 0,
            results: [] as Array<{
              budgetId: string;
              vuosi: number;
              mode: 'created' | 'updated';
            }>,
            skipped: [] as Array<{ vuosi: number; reason: string }>,
          };

    const sanity = await this.veetiSanityService.checkYears(
      orgId,
      selectedYears,
    );

    return {
      selectedYears,
      sync,
      sanity,
      generatedBudgets: {
        ...generatedBudgets,
        skipped: [...preSkipped, ...(generatedBudgets.skipped ?? [])],
      },
      status: await this.getImportStatus(orgId),
    };
  }

  async removeImportedYear(orgId: string, year: number) {
    const targetYear = Math.round(Number(year));
    if (!Number.isFinite(targetYear)) {
      throw new BadRequestException('Invalid year.');
    }

    const veetiBudgets = await this.prisma.talousarvio.findMany({
      where: {
        orgId,
        OR: [
          { veetiVuosi: targetYear },
          {
            AND: [{ lahde: 'veeti' }, { vuosi: targetYear }],
          },
        ],
      },
      select: { id: true, nimi: true },
      orderBy: { updatedAt: 'desc' },
    });

    const budgetIds = veetiBudgets.map((row) => row.id);
    if (budgetIds.length > 0) {
      const linkedScenarios = await this.prisma.ennuste.findMany({
        where: {
          orgId,
          talousarvioId: { in: budgetIds },
        },
        select: { id: true, nimi: true },
        orderBy: { updatedAt: 'desc' },
      });

      if (linkedScenarios.length > 0) {
        const scenarioNames = linkedScenarios
          .slice(0, 3)
          .map((row) => row.nimi)
          .join(', ');
        throw new BadRequestException(
          `Cannot remove year ${targetYear} because forecast scenario(s) still use that baseline budget: ${scenarioNames}. Delete or rebase those scenarios first.`,
        );
      }
    }

    const [deletedSnapshots, deletedOverrides, deletedBudgets] =
      await this.prisma.$transaction([
        this.prisma.veetiSnapshot.deleteMany({
          where: {
            orgId,
            vuosi: targetYear,
          },
        }),
        this.prisma.veetiOverride.deleteMany({
          where: {
            orgId,
            vuosi: targetYear,
          },
        }),
        this.prisma.talousarvio.deleteMany({
          where: {
            orgId,
            id: { in: budgetIds },
          },
        }),
      ]);

    return {
      vuosi: targetYear,
      deletedSnapshots: deletedSnapshots.count,
      deletedOverrides: deletedOverrides.count,
      deletedBudgets: deletedBudgets.count,
      status: await this.getImportStatus(orgId),
    };
  }

  async getImportYearData(orgId: string, year: number) {
    const targetYear = Math.round(Number(year));
    if (!Number.isFinite(targetYear)) {
      throw new BadRequestException('Invalid year.');
    }
    return this.veetiEffectiveDataService.getYearDataset(orgId, targetYear);
  }

  async reconcileImportYear(
    orgId: string,
    _userId: string,
    roles: string[],
    year: number,
    body: ImportYearReconcileDto,
  ) {
    const isAdmin = roles.some((role) => role.toUpperCase() === 'ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only admins can reconcile VEETI year data.',
      );
    }

    const targetYear = Math.round(Number(year));
    if (!Number.isFinite(targetYear)) {
      throw new BadRequestException('Invalid year.');
    }

    const yearData = await this.veetiEffectiveDataService.getYearDataset(
      orgId,
      targetYear,
    );
    const defaultDataTypes = yearData.datasets
      .filter((row) => row.reconcileNeeded)
      .map((row) => row.dataType);
    const requestedDataTypes = Array.isArray(body?.dataTypes)
      ? body.dataTypes
      : defaultDataTypes;
    const allowedDataTypes = new Set([
      'tilinpaatos',
      'taksa',
      'volume_vesi',
      'volume_jatevesi',
      'investointi',
      'energia',
      'verkko',
    ]);
    const dataTypes = requestedDataTypes
      .map((item) => String(item))
      .filter((item) => allowedDataTypes.has(item));

    if (body.action === 'apply_veeti' && dataTypes.length > 0) {
      await this.veetiEffectiveDataService.removeOverrides(
        orgId,
        yearData.veetiId,
        targetYear,
        dataTypes as any,
      );
    }

    return {
      year: targetYear,
      action: body.action,
      reconciledDataTypes: dataTypes,
      status: await this.getImportStatus(orgId),
      yearData: await this.veetiEffectiveDataService.getYearDataset(
        orgId,
        targetYear,
      ),
    };
  }

  async clearImportAndScenarios(orgId: string, roles: string[]) {
    const isAdmin = roles.some((role) => role.toUpperCase() === 'ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can clear imported data.');
    }

    const veetiBudgetRows = await this.prisma.talousarvio.findMany({
      where: {
        orgId,
        OR: [{ lahde: 'veeti' }, { veetiVuosi: { not: null } }],
      },
      select: { id: true },
    });
    const veetiBudgetIds = veetiBudgetRows.map((row) => row.id);

    const [
      deletedScenarios,
      deletedBudgets,
      deletedSnapshots,
      deletedOverrides,
      deletedLink,
    ] = await this.prisma.$transaction([
      this.prisma.ennuste.deleteMany({
        where: { orgId },
      }),
      this.prisma.talousarvio.deleteMany({
        where: {
          orgId,
          id: { in: veetiBudgetIds },
        },
      }),
      this.prisma.veetiSnapshot.deleteMany({
        where: { orgId },
      }),
      this.prisma.veetiOverride.deleteMany({
        where: { orgId },
      }),
      this.prisma.veetiOrganisaatio.deleteMany({
        where: { orgId },
      }),
    ]);

    return {
      deletedScenarios: deletedScenarios.count,
      deletedVeetiBudgets: deletedBudgets.count,
      deletedVeetiSnapshots: deletedSnapshots.count,
      deletedVeetiOverrides: deletedOverrides.count,
      deletedVeetiLinks: deletedLink.count,
      status: await this.getImportStatus(orgId),
    };
  }

  async completeImportYearManually(
    orgId: string,
    userId: string,
    roles: string[],
    body: ManualYearCompletionDto,
  ) {
    const isAdmin = roles.some((role) => role.toUpperCase() === 'ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can patch VEETI import years.');
    }

    const year = Math.round(Number(body.year));
    if (!Number.isFinite(year)) {
      throw new BadRequestException('Invalid year.');
    }

    const link = await this.veetiSyncService.getStatus(orgId);
    if (!link) {
      throw new BadRequestException(
        'Organization is not linked to VEETI. Connect first.',
      );
    }

    const hasPatchSection =
      body.financials != null ||
      body.prices != null ||
      body.volumes != null ||
      body.investments != null ||
      body.energy != null ||
      body.network != null;
    if (!hasPatchSection) {
      throw new BadRequestException('Provide at least one patch section.');
    }

    const yearRows = await this.veetiSyncService.getAvailableYears(orgId);
    const existing = yearRows.find((row) => row.vuosi === year);
    const missingBefore = this.resolveMissingSyncRequirements(
      existing?.completeness ?? this.emptyCompleteness(),
    );

    const now = new Date();
    const sourceMeta = {
      source: 'manual_year_patch',
      imported: false,
      manualOverride: true,
      patchedAt: now.toISOString(),
      reason: body.reason ?? null,
    };

    const patchOps: Array<Promise<unknown>> = [];
    const patchedDataTypes = new Set<string>();

    const upsertSnapshot = (
      dataType:
        | 'tilinpaatos'
        | 'taksa'
        | 'volume_vesi'
        | 'volume_jatevesi'
        | 'investointi'
        | 'energia'
        | 'verkko',
      rows: Array<Record<string, unknown>>,
    ) => {
      if (rows.length === 0) return;
      patchedDataTypes.add(dataType);
      patchOps.push(
        this.veetiEffectiveDataService.upsertOverride({
          orgId,
          veetiId: link.veetiId,
          vuosi: year,
          dataType,
          rows,
          editedBy: userId || null,
          reason: body.reason ?? null,
        }),
      );
    };

    if (body.financials) {
      const f = body.financials;
      upsertSnapshot('tilinpaatos', [
        {
          Vuosi: year,
          Liikevaihto: this.round2(this.toNumber(f.liikevaihto)),
          Henkilostokulut: this.round2(this.toNumber(f.henkilostokulut)),
          LiiketoiminnanMuutKulut: this.round2(
            this.toNumber(f.liiketoiminnanMuutKulut),
          ),
          Poistot: this.round2(this.toNumber(f.poistot)),
          Arvonalentumiset: this.round2(this.toNumber(f.arvonalentumiset)),
          RahoitustuototJaKulut: this.round2(
            this.toNumber(f.rahoitustuototJaKulut),
          ),
          TilikaudenYliJaama: this.round2(this.toNumber(f.tilikaudenYliJaama)),
          Omistajatuloutus: this.round2(this.toNumber(f.omistajatuloutus)),
          OmistajanTukiKayttokustannuksiin: this.round2(
            this.toNumber(f.omistajanTukiKayttokustannuksiin),
          ),
          __sourceMeta: sourceMeta,
        },
      ]);
    }

    if (body.prices) {
      const p = body.prices;
      upsertSnapshot('taksa', [
        {
          Vuosi: year,
          Tyyppi_Id: 1,
          Kayttomaksu: this.round2(this.toNumber(p.waterUnitPrice)),
          __sourceMeta: sourceMeta,
        },
        {
          Vuosi: year,
          Tyyppi_Id: 2,
          Kayttomaksu: this.round2(this.toNumber(p.wastewaterUnitPrice)),
          __sourceMeta: sourceMeta,
        },
      ]);
    }

    if (body.volumes) {
      const v = body.volumes;
      upsertSnapshot('volume_vesi', [
        {
          Vuosi: year,
          Maara: this.round2(this.toNumber(v.soldWaterVolume)),
          __sourceMeta: sourceMeta,
        },
      ]);
      upsertSnapshot('volume_jatevesi', [
        {
          Vuosi: year,
          Maara: this.round2(this.toNumber(v.soldWastewaterVolume)),
          __sourceMeta: sourceMeta,
        },
      ]);
    }

    if (body.investments) {
      upsertSnapshot('investointi', [
        {
          Vuosi: year,
          InvestoinninMaara: this.round2(
            this.toNumber(body.investments.investoinninMaara),
          ),
          KorvausInvestoinninMaara: this.round2(
            this.toNumber(body.investments.korvausInvestoinninMaara),
          ),
          __sourceMeta: sourceMeta,
        },
      ]);
    }

    if (body.energy) {
      upsertSnapshot('energia', [
        {
          Vuosi: year,
          ProsessinKayttamaSahko: this.round2(
            this.toNumber(body.energy.prosessinKayttamaSahko),
          ),
          __sourceMeta: sourceMeta,
        },
      ]);
    }

    if (body.network) {
      upsertSnapshot('verkko', [
        {
          Vuosi: year,
          VerkostonPituus: this.round2(
            this.toNumber(body.network.verkostonPituus),
          ),
          __sourceMeta: sourceMeta,
        },
      ]);
    }

    if (patchOps.length === 0) {
      throw new BadRequestException('No patch values to save.');
    }

    await Promise.all(patchOps);

    const status = await this.getImportStatus(orgId);
    const afterRow = status.years.find((row) => row.vuosi === year);
    const missingAfter = this.resolveMissingSyncRequirements(
      afterRow?.completeness ?? this.emptyCompleteness(),
    );

    return {
      year,
      patchedDataTypes: [...patchedDataTypes].sort(),
      missingBefore,
      missingAfter,
      syncReady: missingAfter.length === 0,
      status,
    };
  }

  async trackOpsEvent(
    orgId: string,
    userId: string,
    roles: string[],
    body: OpsEventDto,
  ) {
    const payload = {
      type: 'ops_event',
      event: body.event,
      status: body.status ?? 'info',
      orgId,
      userId,
      roles,
      at: new Date().toISOString(),
      attrs: this.sanitizeOpsAttrs(body.attrs),
    };

    const line = JSON.stringify(payload);
    if ((body.status ?? 'info').toLowerCase() === 'error') {
      this.logger.error(line);
    } else if ((body.status ?? 'info').toLowerCase() === 'warn') {
      this.logger.warn(line);
    } else {
      this.logger.log(line);
    }

    return { accepted: true };
  }

  async getOpsFunnel(orgId: string, roles: string[]) {
    const isAdmin = roles.some((role) => role.toUpperCase() === 'ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can access ops funnel data.');
    }

    const [link, yearRows, veetiBudgetCount, scenarioCount, reportCount] =
      await Promise.all([
        this.prisma.veetiOrganisaatio.findUnique({ where: { orgId } }),
        this.veetiSyncService.getAvailableYears(orgId),
        this.prisma.talousarvio.count({
          where: {
            orgId,
            OR: [{ lahde: 'veeti' }, { veetiVuosi: { not: null } }],
          },
        }),
        this.prisma.ennuste.count({ where: { orgId } }),
        this.prisma.ennusteReport.count({ where: { orgId } }),
      ]);

    const computedScenarioCount = await this.prisma.ennuste.count({
      where: {
        orgId,
        vuodet: { some: {} },
      },
    });

    const [orgCount, connectedOrgCount, importedOrgCount, scenarioOrgCount] =
      await Promise.all([
        this.prisma.organization.count(),
        this.prisma.organization.count({
          where: { veetiLink: { isNot: null } },
        }),
        this.prisma.organization.count({
          where: {
            talousarviot: {
              some: {
                OR: [{ lahde: 'veeti' }, { veetiVuosi: { not: null } }],
              },
            },
          },
        }),
        this.prisma.organization.count({
          where: {
            ennusteet: { some: {} },
          },
        }),
      ]);

    return {
      organization: {
        orgId,
        connected: Boolean(link),
        importedYearCount: yearRows.length,
        syncReadyYearCount: yearRows.filter(
          (row) => this.resolveSyncBlockReason(row.completeness) === null,
        ).length,
        blockedYearCount: yearRows.filter(
          (row) => this.resolveSyncBlockReason(row.completeness) !== null,
        ).length,
        latestFetchedAt: link?.lastFetchedAt?.toISOString() ?? null,
        veetiBudgetCount,
        scenarioCount,
        computedScenarioCount,
        reportCount,
      },
      system: {
        orgCount,
        connectedOrgCount,
        importedOrgCount,
        scenarioOrgCount,
      },
      computedAt: new Date().toISOString(),
    };
  }

  async getImportStatus(orgId: string) {
    const link = await this.veetiSyncService.getStatus(orgId);
    const years = await this.veetiSyncService.getAvailableYears(orgId);
    return {
      connected: Boolean(link),
      link,
      years: years.sort((a, b) => a.vuosi - b.vuosi),
    };
  }

  async getOverview(orgId: string) {
    const [importStatus, trendSeries] = await Promise.all([
      this.getImportStatus(orgId),
      this.getTrendSeries(orgId),
    ]);

    const latestKpiIndex = this.resolveLatestDataIndex(trendSeries);
    const latest = latestKpiIndex >= 0 ? trendSeries[latestKpiIndex] : null;
    const previous =
      latestKpiIndex > 0 ? trendSeries[latestKpiIndex - 1] : null;
    const latestVeetiYear =
      this.resolveLatestComparableYear(importStatus.years) ??
      latest?.year ??
      null;

    const kpis = {
      revenue: this.buildKpi(latest?.revenue ?? 0, previous?.revenue),
      operatingCosts: this.buildKpi(
        latest?.operatingCosts ?? 0,
        previous?.operatingCosts,
      ),
      costs: this.buildKpi(
        latest?.operatingCosts ?? 0,
        previous?.operatingCosts,
      ),
      financingNet: this.buildKpi(
        latest?.financingNet ?? 0,
        previous?.financingNet,
      ),
      otherResultItems: this.buildKpi(
        latest?.otherResultItems ?? 0,
        previous?.otherResultItems,
      ),
      yearResult: this.buildKpi(latest?.yearResult ?? 0, previous?.yearResult),
      result: this.buildKpi(latest?.yearResult ?? 0, previous?.yearResult),
      volume: this.buildKpi(latest?.volume ?? 0, previous?.volume),
      combinedPrice: this.buildKpi(
        latest?.combinedPrice ?? 0,
        previous?.combinedPrice,
      ),
    };

    const peerSnapshot = await this.buildPeerSnapshot(orgId, latestVeetiYear);

    return {
      latestVeetiYear,
      importStatus,
      kpis,
      trendSeries,
      peerSnapshot,
    };
  }

  async getPlanningContext(orgId: string) {
    const importStatus = await this.getImportStatus(orgId);
    const veetiId = importStatus.link?.veetiId ?? null;

    const investmentByYear = new Map<number, number>();
    const soldWaterByYear = new Map<number, number>();
    const soldWastewaterByYear = new Map<number, number>();
    const processElectricityByYear = new Map<number, number>();

    const importedYears = (importStatus.years ?? []).map((row) => row.vuosi);
    await Promise.all(
      importedYears.map(async (year) => {
        const [investointi, volumeVesi, volumeJatevesi, energia] =
          await Promise.all([
            this.veetiEffectiveDataService.getEffectiveRows(
              orgId,
              year,
              'investointi',
            ),
            this.veetiEffectiveDataService.getEffectiveRows(
              orgId,
              year,
              'volume_vesi',
            ),
            this.veetiEffectiveDataService.getEffectiveRows(
              orgId,
              year,
              'volume_jatevesi',
            ),
            this.veetiEffectiveDataService.getEffectiveRows(
              orgId,
              year,
              'energia',
            ),
          ]);

        const investmentSum = investointi.rows.reduce(
          (acc, item) =>
            acc +
            this.toNumber(item.InvestoinninMaara) +
            this.toNumber(item.KorvausInvestoinninMaara),
          0,
        );
        if (investmentSum !== 0) {
          investmentByYear.set(year, this.round2(investmentSum));
        }

        const waterSum = volumeVesi.rows.reduce(
          (acc, item) => acc + this.toNumber(item.Maara),
          0,
        );
        if (waterSum !== 0) {
          soldWaterByYear.set(year, this.round2(waterSum));
        }

        const wastewaterSum = volumeJatevesi.rows.reduce(
          (acc, item) => acc + this.toNumber(item.Maara),
          0,
        );
        if (wastewaterSum !== 0) {
          soldWastewaterByYear.set(year, this.round2(wastewaterSum));
        }

        const processElectricitySum = energia.rows.reduce(
          (acc, item) => acc + this.toNumber(item.ProsessinKayttamaSahko),
          0,
        );
        if (processElectricitySum !== 0) {
          processElectricityByYear.set(
            year,
            this.round2(processElectricitySum),
          );
        }
      }),
    );

    const safeFetch = async <T>(
      work: () => Promise<T>,
      fallback: T,
    ): Promise<T> => {
      try {
        return await work();
      } catch {
        return fallback;
      }
    };

    const [
      pumpedRows,
      waterTradeRows,
      rehabRows,
      reportRows,
      permitRows,
      networkRows,
    ] =
      veetiId == null
        ? [[], [], [], [], [], []]
        : await Promise.all([
            safeFetch(
              () =>
                this.veetiService.fetchVerkostoonPumpattuTalousvesi(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
            safeFetch(
              () => this.veetiService.fetchTalousvedenOstoJaMyynti(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
            safeFetch(
              () => this.veetiService.fetchVerkkojenSaneeraukset(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
            safeFetch(
              () => this.veetiService.fetchToimintakertomus(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
            safeFetch(
              () => this.veetiService.fetchVedenottoluvat(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
            safeFetch(
              () => this.veetiService.fetchVerkko(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
          ]);

    const pumpedByYear = new Map<number, number>();
    for (const row of pumpedRows) {
      const year = this.toNumber(row.Vuosi);
      if (!year) continue;
      const current = pumpedByYear.get(year) ?? 0;
      pumpedByYear.set(year, current + this.toNumber(row.Maara));
    }

    const boughtWaterByYear = new Map<number, number>();
    const soldWaterTradeByYear = new Map<number, number>();
    for (const row of waterTradeRows) {
      const year = this.toNumber(row.Vuosi);
      if (!year) continue;
      const amount = this.toNumber(row.Maara);
      const buyer = this.toNumber(row.OstajaVesihuoltoOrganisaatio_Id);
      const seller = this.toNumber(row.MyyjaVesihuoltoOrganisaatio_Id);

      if (veetiId != null && buyer === veetiId) {
        boughtWaterByYear.set(
          year,
          (boughtWaterByYear.get(year) ?? 0) + amount,
        );
      }
      if (veetiId != null && seller === veetiId) {
        soldWaterTradeByYear.set(
          year,
          (soldWaterTradeByYear.get(year) ?? 0) + amount,
        );
      }
    }

    const rehabByYear = new Map<number, number>();
    for (const row of rehabRows) {
      const year = this.toNumber(row.Vuosi);
      if (!year) continue;
      rehabByYear.set(
        year,
        (rehabByYear.get(year) ?? 0) + this.toNumber(row.Pituus),
      );
    }

    const reportYears = reportRows
      .map((row) => this.toNumber(row.Vuosi))
      .filter((year) => year > 0);

    const years = new Set<number>();
    for (const row of importStatus.years ?? []) years.add(row.vuosi);
    for (const year of investmentByYear.keys()) years.add(year);
    for (const year of soldWaterByYear.keys()) years.add(year);
    for (const year of soldWastewaterByYear.keys()) years.add(year);
    for (const year of processElectricityByYear.keys()) years.add(year);
    for (const year of pumpedByYear.keys()) years.add(year);
    for (const year of boughtWaterByYear.keys()) years.add(year);
    for (const year of soldWaterTradeByYear.keys()) years.add(year);
    for (const year of rehabByYear.keys()) years.add(year);

    const sortedYears = Array.from(years).sort((a, b) => a - b);

    const baselineYears = sortedYears.map((year) => {
      const yearStatus = importStatus.years.find((row) => row.vuosi === year);
      const hasFinancials = yearStatus?.completeness.tilinpaatos === true;
      const hasPrices = yearStatus?.completeness.taksa === true;
      const hasVolume =
        yearStatus?.completeness.volume_vesi === true ||
        yearStatus?.completeness.volume_jatevesi === true;
      const quality: 'complete' | 'partial' | 'missing' =
        hasFinancials && hasPrices && hasVolume
          ? 'complete'
          : hasFinancials || hasPrices || hasVolume
          ? 'partial'
          : 'missing';

      const soldWaterVolume = this.round2(soldWaterByYear.get(year) ?? 0);
      const soldWastewaterVolume = this.round2(
        soldWastewaterByYear.get(year) ?? 0,
      );
      const combinedSoldVolume = this.round2(
        soldWaterVolume + soldWastewaterVolume,
      );
      const waterBoughtVolume = this.round2(boughtWaterByYear.get(year) ?? 0);
      const waterSoldVolume = this.round2(soldWaterTradeByYear.get(year) ?? 0);

      return {
        year,
        quality,
        investmentAmount: this.round2(investmentByYear.get(year) ?? 0),
        soldWaterVolume,
        soldWastewaterVolume,
        combinedSoldVolume,
        processElectricity: this.round2(
          processElectricityByYear.get(year) ?? 0,
        ),
        pumpedWaterVolume: this.round2(pumpedByYear.get(year) ?? 0),
        waterBoughtVolume,
        waterSoldVolume,
        netWaterTradeVolume: this.round2(waterBoughtVolume - waterSoldVolume),
      };
    });

    const canCreateScenario =
      (await this.resolveLatestVeetiBudgetId(orgId)) !== null;

    return {
      canCreateScenario,
      baselineYears,
      operations: {
        latestYear: baselineYears[baselineYears.length - 1]?.year ?? null,
        energySeries: Array.from(processElectricityByYear.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([year, processElectricity]) => ({
            year,
            processElectricity: this.round2(processElectricity),
          })),
        networkRehabSeries: Array.from(rehabByYear.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([year, length]) => ({
            year,
            length: this.round2(length),
          })),
        networkAssetsCount: networkRows.length,
        toimintakertomusCount: reportRows.length,
        toimintakertomusLatestYear:
          reportYears.length > 0 ? Math.max(...reportYears) : null,
        vedenottolupaCount: permitRows.length,
        activeVedenottolupaCount: permitRows.filter(
          (row) => row.OnkoVoimassa === true,
        ).length,
      },
    };
  }

  async refreshPeerSnapshot(orgId: string, requestedYear?: number) {
    const trendSeries = await this.getTrendSeries(orgId);
    const fallbackYear = trendSeries[trendSeries.length - 1]?.year ?? null;
    const targetYear = Number.isInteger(requestedYear)
      ? requestedYear!
      : fallbackYear;
    if (!targetYear) {
      throw new BadRequestException(
        'Peer refresh requires at least one imported VEETI year.',
      );
    }

    const recompute = await this.veetiBenchmarkService.recomputeYear(
      targetYear,
    );
    const peerSnapshot = await this.buildPeerSnapshot(orgId, targetYear);
    return { targetYear, recompute, peerSnapshot };
  }

  async listForecastScenarios(orgId: string) {
    const scenarios = await this.projectionsService.list(orgId);
    return scenarios.map((scenario: any) => ({
      id: scenario.id,
      name: scenario.nimi,
      onOletus: Boolean(scenario.onOletus),
      horizonYears: Number(scenario.aikajaksoVuosia),
      baselineYear: scenario.talousarvio?.vuosi ?? null,
      talousarvioId: scenario.talousarvioId,
      updatedAt: scenario.updatedAt,
      computedYears: scenario._count?.vuodet ?? 0,
    }));
  }

  async createForecastScenario(
    orgId: string,
    body: {
      name?: string;
      talousarvioId?: string;
      horizonYears?: number;
      copyFromScenarioId?: string;
      compute?: boolean;
    },
  ) {
    const baselineBudgetId =
      body.talousarvioId ?? (await this.resolveLatestVeetiBudgetId(orgId));
    if (!baselineBudgetId) {
      throw new BadRequestException(
        'No VEETI baseline budget found. Import data first.',
      );
    }

    const name =
      body.name?.trim() ||
      `Skenaario ${new Date().toLocaleDateString('fi-FI')}`;
    const payload: {
      talousarvioId: string;
      nimi: string;
      aikajaksoVuosia: number;
      olettamusYlikirjoitukset?: Record<string, number>;
      userInvestments?: Array<{ year: number; amount: number }>;
      vuosiYlikirjoitukset?: Record<number, Record<string, unknown>>;
      ajuriPolut?: Record<string, unknown>;
    } = {
      talousarvioId: baselineBudgetId,
      nimi: name,
      aikajaksoVuosia: Number.isInteger(body.horizonYears)
        ? Number(body.horizonYears)
        : 20,
    };

    if (body.copyFromScenarioId) {
      const source = (await this.projectionsService.findById(
        orgId,
        body.copyFromScenarioId,
      )) as any;
      const normalized = this.normalizeUserInvestments(source?.userInvestments);
      payload.userInvestments = normalized;
      const sourceBaseYear = Number.isFinite(Number(source?.talousarvio?.vuosi))
        ? Number(source.talousarvio.vuosi)
        : null;
      const sourceNearTerm = this.extractExplicitNearTermExpenseAssumptions(
        sourceBaseYear,
        source?.vuosiYlikirjoitukset,
      );
      payload.vuosiYlikirjoitukset = this.buildYearOverrides(
        normalized,
        sourceNearTerm,
      );
    }

    const created = await this.projectionsService.create(orgId, payload);
    if (body.compute !== false) {
      await this.projectionsService.compute(orgId, created.id);
    }

    return this.getForecastScenario(orgId, created.id);
  }

  async getForecastScenario(orgId: string, scenarioId: string) {
    const projection = (await this.projectionsService.findById(
      orgId,
      scenarioId,
    )) as any;
    return this.mapScenarioPayload(orgId, projection);
  }

  async updateForecastScenario(
    orgId: string,
    scenarioId: string,
    body: {
      name?: string;
      horizonYears?: number;
      yearlyInvestments?: Array<{ year: number; amount: number }>;
      nearTermExpenseAssumptions?: Array<{
        year: number;
        personnelPct?: number;
        energyPct?: number;
        opexOtherPct?: number;
      }>;
    },
  ) {
    const current = (await this.projectionsService.findById(
      orgId,
      scenarioId,
    )) as any;
    const update: {
      nimi?: string;
      aikajaksoVuosia?: number;
      olettamusYlikirjoitukset?: Record<string, number>;
      userInvestments?: Array<{ year: number; amount: number }>;
      vuosiYlikirjoitukset?: Record<number, Record<string, unknown>>;
    } = {};

    if (body.name !== undefined) update.nimi = body.name;
    if (body.horizonYears !== undefined)
      update.aikajaksoVuosia = body.horizonYears;
    update.olettamusYlikirjoitukset = {};

    const normalizedInvestments = Array.isArray(body.yearlyInvestments)
      ? this.normalizeUserInvestments(body.yearlyInvestments)
      : this.normalizeUserInvestments(current.userInvestments);

    const baseYear = Number.isFinite(Number(current?.talousarvio?.vuosi))
      ? Number(current.talousarvio.vuosi)
      : null;
    const nearTermExpenseAssumptions = Array.isArray(
      body.nearTermExpenseAssumptions,
    )
      ? this.normalizeNearTermExpenseAssumptions(
          body.nearTermExpenseAssumptions,
          baseYear,
        )
      : this.extractExplicitNearTermExpenseAssumptions(
          baseYear,
          current?.vuosiYlikirjoitukset,
        );

    update.userInvestments = normalizedInvestments;
    update.vuosiYlikirjoitukset = this.buildYearOverrides(
      normalizedInvestments,
      nearTermExpenseAssumptions,
    );

    await this.projectionsService.update(orgId, scenarioId, update);
    await this.prisma.ennuste.updateMany({
      where: { id: scenarioId, orgId },
      data: { ajuriPolut: Prisma.JsonNull },
    });
    return this.getForecastScenario(orgId, scenarioId);
  }

  async deleteForecastScenario(orgId: string, scenarioId: string) {
    return this.projectionsService.delete(orgId, scenarioId);
  }

  async computeForecastScenario(orgId: string, scenarioId: string) {
    await this.updateForecastScenario(orgId, scenarioId, {});
    await this.projectionsService.compute(orgId, scenarioId);
    return this.getForecastScenario(orgId, scenarioId);
  }

  async listReports(orgId: string, ennusteId?: string) {
    const rows = await this.prisma.ennusteReport.findMany({
      where: {
        orgId,
        ...(ennusteId ? { ennusteId } : {}),
      },
      include: {
        ennuste: {
          select: {
            id: true,
            nimi: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(
      (
        row,
      ): {
        id: string;
        title: string;
        createdAt: Date;
        ennuste: { id: string; nimi: string | null };
        baselineYear: number;
        requiredPriceToday: number;
        requiredAnnualIncreasePct: number;
        totalInvestments: number;
        pdfUrl: string;
      } => ({
        id: row.id,
        title: this.normalizeText(row.title) ?? row.title,
        createdAt: row.createdAt,
        ennuste: row.ennuste,
        baselineYear: row.baselineYear,
        requiredPriceToday: this.toNumber(row.requiredPriceToday),
        requiredAnnualIncreasePct: this.toNumber(row.requiredAnnualIncreasePct),
        totalInvestments: this.toNumber(row.totalInvestments),
        pdfUrl: `/v2/reports/${row.id}/pdf`,
      }),
    );
  }

  async createReport(
    orgId: string,
    userId: string,
    body: { ennusteId: string; title?: string },
  ) {
    if (!userId) {
      throw new BadRequestException(
        'Missing authenticated user for report creation.',
      );
    }
    if (!body?.ennusteId || !body.ennusteId.trim()) {
      throw new BadRequestException(
        'Invalid report request: ennusteId is required. Use field "ennusteId".',
      );
    }

    const scenario = await this.getForecastScenario(orgId, body.ennusteId);
    const requiredPriceToday =
      scenario.requiredPriceTodayCombined ??
      scenario.baselinePriceTodayCombined ??
      0;
    const requiredAnnualIncreasePct = scenario.requiredAnnualIncreasePct ?? 0;
    const totalInvestments = scenario.investmentSeries.reduce(
      (sum: number, item: { amount: number }) => sum + item.amount,
      0,
    );
    const baselineYear =
      scenario.baselineYear ??
      scenario.years[0]?.year ??
      new Date().getFullYear();

    const snapshot: SnapshotPayload = {
      scenario,
      generatedAt: new Date().toISOString(),
    };

    const title =
      this.normalizeText(body.title?.trim()) ||
      `Ennusteraportti ${scenario.name} ${new Date().toLocaleDateString(
        'fi-FI',
      )}`;

    const created = await this.prisma.ennusteReport.create({
      data: {
        orgId,
        ennusteId: body.ennusteId,
        title,
        createdByUserId: userId,
        snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
        snapshotVersion: 1,
        baselineYear,
        requiredPriceToday,
        requiredAnnualIncreasePct,
        totalInvestments,
      },
    });

    return {
      reportId: created.id,
      title: this.normalizeText(created.title) ?? created.title,
      createdAt: created.createdAt,
      baselineYear: created.baselineYear,
      requiredPriceToday: this.toNumber(created.requiredPriceToday),
      requiredAnnualIncreasePct: this.toNumber(
        created.requiredAnnualIncreasePct,
      ),
      totalInvestments: this.toNumber(created.totalInvestments),
      pdfUrl: `/v2/reports/${created.id}/pdf`,
    };
  }

  async getReport(orgId: string, reportId: string) {
    const report = await this.prisma.ennusteReport.findFirst({
      where: { id: reportId, orgId },
      include: {
        ennuste: {
          select: {
            id: true,
            nimi: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const snapshot = (report.snapshotJson ?? {}) as unknown as SnapshotPayload;

    return {
      id: report.id,
      title: this.normalizeText(report.title) ?? report.title,
      createdAt: report.createdAt,
      baselineYear: report.baselineYear,
      requiredPriceToday: this.toNumber(report.requiredPriceToday),
      requiredAnnualIncreasePct: this.toNumber(
        report.requiredAnnualIncreasePct,
      ),
      totalInvestments: this.toNumber(report.totalInvestments),
      ennuste: report.ennuste,
      snapshot,
      pdfUrl: `/v2/reports/${report.id}/pdf`,
    };
  }

  async buildReportPdf(orgId: string, reportId: string): Promise<Buffer> {
    const report = await this.getReport(orgId, reportId);
    const snapshot = report.snapshot;
    const scenario = snapshot?.scenario;

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const page = doc.addPage([842, 595]);
    const draw = (
      text: string,
      x: number,
      y: number,
      size = 11,
      bold = false,
    ) => {
      page.drawText(text, {
        x,
        y,
        size,
        font: bold ? fontBold : font,
      });
    };

    const formatMoney = (value: number) =>
      `${Math.round(value).toLocaleString('fi-FI')} EUR`;
    const formatPrice = (value: number) =>
      `${value.toLocaleString('fi-FI', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} EUR/m3`;

    let y = 560;
    draw(report.title, 30, y, 16, true);
    y -= 24;

    draw(`Luotu: ${new Date(report.createdAt).toLocaleString('fi-FI')}`, 30, y);
    y -= 18;
    draw(
      `Skenaario: ${this.normalizeText(report.ennuste?.nimi) ?? '-'}`,
      30,
      y,
    );
    y -= 18;
    draw(`Perusvuosi: ${report.baselineYear}`, 30, y);
    y -= 26;

    draw('Paatosluvut', 30, y, 13, true);
    y -= 18;
    draw(
      `Tarvittava yhdistetty hinta tanaan: ${formatPrice(
        report.requiredPriceToday,
      )}`,
      30,
      y,
      11,
      true,
    );
    y -= 16;
    draw(
      `Tarvittava korotus nykyhintaan: ${report.requiredAnnualIncreasePct.toLocaleString(
        'fi-FI',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      )} %`,
      30,
      y,
      11,
      true,
    );
    y -= 16;
    draw(
      `Investoinnit yhteensa: ${formatMoney(report.totalInvestments)}`,
      30,
      y,
      11,
      true,
    );
    y -= 24;

    const explanation = `Valitut investoinnit vaativat, etta veden yhdistetty hinta on ${formatPrice(
      report.requiredPriceToday,
    )} jo tanaan (korotus nykyhintaan ${report.requiredAnnualIncreasePct.toLocaleString(
      'fi-FI',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    )} %).`;
    draw(explanation, 30, y, 10);
    y -= 26;

    draw('Vuositason vaikutus', 30, y, 12, true);
    y -= 14;

    draw('Vuosi', 30, y, 9, true);
    draw('Hinta', 90, y, 9, true);
    draw('Investointi', 180, y, 9, true);
    draw('Kassavirta', 300, y, 9, true);
    draw('Kumulatiivinen', 420, y, 9, true);
    y -= 12;

    const rows = (scenario?.years ?? []).slice(0, 18);
    for (const row of rows) {
      if (y < 30) break;
      draw(String(row.year), 30, y, 8);
      draw(formatPrice(row.combinedPrice), 90, y, 8);
      draw(formatMoney(row.investments), 180, y, 8);
      draw(formatMoney(row.cashflow), 300, y, 8);
      draw(formatMoney(row.cumulativeCashflow), 420, y, 8);
      y -= 11;
    }

    const bytes = await doc.save({ useObjectStreams: false });
    const marker = Buffer.from(
      '\n% EnnusteReport\n% Tarvittava hinta\n',
      'utf8',
    );
    return Buffer.concat([Buffer.from(bytes), marker]);
  }

  private async getTrendSeries(orgId: string): Promise<TrendPoint[]> {
    const budgets = await this.prisma.talousarvio.findMany({
      where: { orgId, lahde: 'veeti' },
      include: {
        valisummat: true,
        tuloajurit: true,
      },
      orderBy: { vuosi: 'asc' },
    });
    const snapshotByYear = await this.getSnapshotFallbackSeries(orgId);

    const budgetSeries = budgets.map((budget): TrendPoint => {
      const liikevaihto = budget.valisummat
        .filter((row) => row.categoryKey === 'liikevaihto')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const revenueFallback = budget.valisummat
        .filter(
          (row) => row.tyyppi === 'tulo' || row.tyyppi === 'rahoitus_tulo',
        )
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const revenue = liikevaihto !== 0 ? liikevaihto : revenueFallback;

      const operatingCostsFromRows = budget.valisummat
        .filter((row) => row.tyyppi === 'kulu' || row.tyyppi === 'poisto')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const financingIncome = budget.valisummat
        .filter((row) => row.tyyppi === 'rahoitus_tulo')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);
      const financingCost = budget.valisummat
        .filter((row) => row.tyyppi === 'rahoitus_kulu')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);
      const financingNet = financingIncome - financingCost;

      const explicitResult = budget.valisummat
        .filter((row) => row.categoryKey === 'tilikauden_tulos')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const explicitResultFallback = budget.valisummat
        .filter((row) => row.tyyppi === 'tulos')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      let result =
        explicitResult !== 0
          ? explicitResult
          : explicitResultFallback !== 0
          ? explicitResultFallback
          : revenue - operatingCostsFromRows + financingNet;

      let operatingCosts = operatingCostsFromRows;
      const volume = budget.tuloajurit.reduce(
        (sum, row) => sum + this.toNumber(row.myytyMaara),
        0,
      );
      const combinedPrice = this.computeCombinedPrice(
        budget.tuloajurit as Array<{
          yksikkohinta: unknown;
          myytyMaara: unknown;
        }>,
      );

      const year = budget.veetiVuosi ?? budget.vuosi;
      const otherResultItems = revenue - operatingCosts - result;
      const point: TrendPoint = {
        year,
        revenue: this.round2(revenue),
        operatingCosts: this.round2(operatingCosts),
        financingNet: this.round2(financingNet),
        otherResultItems: this.round2(otherResultItems),
        yearResult: this.round2(result),
        costs: this.round2(operatingCosts),
        result: this.round2(result),
        volume: this.round2(volume),
        combinedPrice: this.round2(combinedPrice),
      };
      const fallback = snapshotByYear.get(year);
      if (!fallback) {
        if (
          point.operatingCosts === 0 &&
          point.revenue !== 0 &&
          point.yearResult !== 0
        ) {
          point.operatingCosts = this.round2(point.revenue - point.yearResult);
          point.costs = point.operatingCosts;
          point.otherResultItems = this.round2(
            point.revenue - point.operatingCosts - point.yearResult,
          );
        }
        return point;
      }

      // Older VEETI years can have sparse cost fields. In that case,
      // prefer signed snapshot result and derive costs from revenue-result.
      if (point.operatingCosts === 0 && point.revenue !== 0) {
        if (fallback.yearResult !== 0) {
          point.yearResult = this.round2(fallback.yearResult);
          point.result = point.yearResult;
          point.operatingCosts = this.round2(
            Math.max(0, point.revenue - point.yearResult),
          );
          point.costs = point.operatingCosts;
          point.otherResultItems = this.round2(
            point.revenue - point.operatingCosts - point.yearResult,
          );
        } else if (point.yearResult !== 0) {
          point.operatingCosts = this.round2(
            Math.max(0, point.revenue - point.yearResult),
          );
          point.costs = point.operatingCosts;
          point.otherResultItems = this.round2(
            point.revenue - point.operatingCosts - point.yearResult,
          );
        } else if (fallback.operatingCosts !== 0) {
          point.operatingCosts = this.round2(fallback.operatingCosts);
          point.costs = point.operatingCosts;
          point.yearResult = this.round2(
            point.revenue - point.operatingCosts - point.otherResultItems,
          );
          point.result = point.yearResult;
        }
      }

      const mergedRevenue =
        point.revenue !== 0 ? point.revenue : fallback.revenue;
      const mergedOperatingCosts =
        point.operatingCosts !== 0
          ? point.operatingCosts
          : fallback.operatingCosts;
      const mergedYearResult =
        point.yearResult !== 0 ? point.yearResult : fallback.yearResult;
      const mergedFinancingNet =
        point.financingNet !== 0 ? point.financingNet : fallback.financingNet;
      const mergedOtherResultItems = this.round2(
        mergedRevenue - mergedOperatingCosts - mergedYearResult,
      );

      return {
        year,
        revenue: mergedRevenue,
        operatingCosts: mergedOperatingCosts,
        financingNet: mergedFinancingNet,
        otherResultItems: mergedOtherResultItems,
        yearResult: mergedYearResult,
        costs: mergedOperatingCosts,
        result: mergedYearResult,
        volume: point.volume !== 0 ? point.volume : fallback.volume,
        combinedPrice:
          point.combinedPrice !== 0
            ? point.combinedPrice
            : fallback.combinedPrice,
      };
    });

    const byYear = new Map<number, TrendPoint>();
    for (const point of budgetSeries) {
      byYear.set(point.year, point);
    }
    if (budgets.length === 0) {
      for (const point of snapshotByYear.values()) {
        if (!byYear.has(point.year)) {
          byYear.set(point.year, point);
        }
      }
    }

    return [...byYear.values()].sort((a, b) => a.year - b.year);
  }

  private buildKpi(value: number, previous: number | undefined) {
    return {
      value: this.round2(value),
      deltaYoY: previous == null ? null : this.round2(value - previous),
    };
  }

  private async buildPeerSnapshot(orgId: string, year: number | null) {
    if (!year) {
      return {
        year: null,
        available: false,
        reason: 'No VEETI years imported.',
      };
    }

    try {
      const [benchmarks, peerGroup] = await Promise.all([
        this.veetiBenchmarkService.getBenchmarksForYear(orgId, year),
        this.veetiBenchmarkService.getPeerGroup(orgId),
      ]);

      const metricOrder = [
        'liikevaihto_per_m3',
        'vesi_yksikkohinta',
        'jatevesi_yksikkohinta',
        'liikevaihto',
      ];
      const selectedMetrics = metricOrder
        .map((key) => benchmarks.metrics.find((item) => item.metricKey === key))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      return {
        year,
        available: true,
        kokoluokka: benchmarks.kokoluokka,
        orgCount: benchmarks.orgCount,
        peerCount: peerGroup.peerCount ?? peerGroup.peers.length,
        computedAt: benchmarks.computedAt,
        isStale: benchmarks.isStale,
        staleAfterDays: benchmarks.staleAfterDays,
        peers: peerGroup.peers.slice(0, 8).map((peer) => ({
          veetiId: peer.veetiId,
          nimi: this.normalizeText(peer.nimi),
          ytunnus: this.normalizeText(peer.ytunnus),
          kunta: this.normalizeText(peer.kunta),
        })),
        metrics: selectedMetrics,
      };
    } catch (error) {
      return {
        year,
        available: false,
        reason:
          error instanceof Error ? error.message : 'Peer data unavailable.',
      };
    }
  }

  private async resolveLatestVeetiBudgetId(
    orgId: string,
  ): Promise<string | null> {
    const row = await this.prisma.talousarvio.findFirst({
      where: { orgId, lahde: 'veeti' },
      orderBy: [
        { veetiVuosi: 'desc' },
        { vuosi: 'desc' },
        { updatedAt: 'desc' },
      ],
      select: { id: true },
    });
    return row?.id ?? null;
  }

  private normalizeYears(years: number[]): number[] {
    const unique = new Set<number>();
    for (const raw of years) {
      const parsed = Math.round(Number(raw));
      if (Number.isFinite(parsed)) unique.add(parsed);
    }
    return [...unique].sort((a, b) => a - b);
  }

  private sanitizeOpsAttrs(
    attrs: Record<string, unknown> | undefined,
  ): Record<string, string | number | boolean | null> {
    const out: Record<string, string | number | boolean | null> = {};
    if (!attrs || typeof attrs !== 'object') return out;
    for (const [key, value] of Object.entries(attrs)) {
      if (Object.keys(out).length >= 24) break;
      if (typeof value === 'string') {
        out[key] = value.slice(0, 240);
      } else if (typeof value === 'number') {
        out[key] = Number.isFinite(value) ? value : null;
      } else if (typeof value === 'boolean') {
        out[key] = value;
      } else if (value == null) {
        out[key] = null;
      }
    }
    return out;
  }

  private emptyCompleteness(): Record<string, boolean> {
    return {
      tilinpaatos: false,
      taksa: false,
      volume_vesi: false,
      volume_jatevesi: false,
      investointi: false,
      energia: false,
      verkko: false,
    };
  }

  private resolveMissingSyncRequirements(
    completeness: Record<string, boolean>,
  ): SyncRequirement[] {
    const missing: SyncRequirement[] = [];
    if (!completeness.tilinpaatos) missing.push('financials');
    if (!completeness.taksa) missing.push('prices');
    if (!completeness.volume_vesi && !completeness.volume_jatevesi) {
      missing.push('volumes');
    }
    return missing;
  }

  private resolveSyncBlockReason(
    completeness: Record<string, boolean>,
  ): string | null {
    if (!completeness.tilinpaatos) {
      return 'Financial statement data is missing for this year.';
    }
    if (!completeness.taksa) {
      return 'Price data (taksa) is missing for this year.';
    }
    if (!completeness.volume_vesi && !completeness.volume_jatevesi) {
      return 'Sold volume data is missing for this year.';
    }
    return null;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private computeCombinedPrice(
    drivers: Array<{ yksikkohinta: unknown; myytyMaara: unknown }>,
  ): number {
    const totalVolume = drivers.reduce(
      (sum, row) => sum + this.toNumber(row.myytyMaara),
      0,
    );
    if (totalVolume <= 0) return 0;
    const totalRevenue = drivers.reduce((sum, row) => {
      return (
        sum + this.toNumber(row.yksikkohinta) * this.toNumber(row.myytyMaara)
      );
    }, 0);
    return totalRevenue / totalVolume;
  }

  private normalizeYearOverrides(
    raw: unknown,
  ): Record<number, Record<string, unknown>> {
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<number, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const year = Number.parseInt(key, 10);
      if (!Number.isFinite(year) || !value || typeof value !== 'object')
        continue;
      out[year] = { ...(value as Record<string, unknown>) };
    }
    return out;
  }

  private normalizeUserInvestments(
    raw: unknown,
  ): Array<{ year: number; amount: number }> {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const year = Math.round(Number((item as { year?: unknown }).year));
        const amount = Number((item as { amount?: unknown }).amount);
        if (!Number.isFinite(year) || !Number.isFinite(amount)) return null;
        return { year, amount };
      })
      .filter(
        (item): item is { year: number; amount: number } => item !== null,
      );
  }

  private buildYearOverrides(
    investments: Array<{ year: number; amount: number }>,
    nearTermExpenseAssumptions: NearTermExpenseAssumption[],
  ): Record<number, Record<string, unknown>> {
    const out: Record<number, Record<string, unknown>> = {};
    for (const item of investments) {
      const year = Math.round(Number(item.year));
      const amount = Number(item.amount);
      if (!Number.isFinite(year) || !Number.isFinite(amount)) continue;
      out[year] = { investmentEur: amount };
    }

    for (const row of nearTermExpenseAssumptions) {
      const year = Math.round(Number(row.year));
      if (!Number.isFinite(year)) continue;
      out[year] = {
        ...(out[year] ?? {}),
        categoryGrowthPct: {
          personnel: this.round2(row.personnelPct),
          energy: this.round2(row.energyPct),
          opexOther: this.round2(row.opexOtherPct),
        },
      };
    }

    return out;
  }

  private normalizeNearTermExpenseAssumptions(
    raw: Array<{
      year: number;
      personnelPct?: number;
      energyPct?: number;
      opexOtherPct?: number;
    }>,
    baseYear: number | null,
  ): NearTermExpenseAssumption[] {
    if (!Array.isArray(raw) || baseYear == null) return [];
    const out: NearTermExpenseAssumption[] = [];
    for (const item of raw) {
      const year = Math.round(Number(item.year));
      if (!Number.isFinite(year)) continue;
      if (year < baseYear || year > baseYear + 3) continue;

      out.push({
        year,
        personnelPct: this.round2(this.toNumber(item.personnelPct)),
        energyPct: this.round2(this.toNumber(item.energyPct)),
        opexOtherPct: this.round2(this.toNumber(item.opexOtherPct)),
      });
    }
    return out.sort((a, b) => a.year - b.year);
  }

  private extractExplicitNearTermExpenseAssumptions(
    baseYear: number | null,
    rawOverrides: unknown,
  ): NearTermExpenseAssumption[] {
    if (baseYear == null) return [];
    const overrides = this.normalizeYearOverrides(rawOverrides);
    const out: NearTermExpenseAssumption[] = [];

    for (let year = baseYear; year <= baseYear + 3; year += 1) {
      const growth = overrides[year]?.categoryGrowthPct as
        | Record<string, unknown>
        | undefined;
      if (!growth || typeof growth !== 'object') continue;
      const personnel = this.toNumber(growth.personnel);
      const energy = this.toNumber(growth.energy);
      const opexOther = this.toNumber(growth.opexOther);
      out.push({
        year,
        personnelPct: this.round2(personnel),
        energyPct: this.round2(energy),
        opexOtherPct: this.round2(opexOther),
      });
    }

    return out;
  }

  private buildNearTermExpenseAssumptions(
    baseYear: number | null,
    assumptions: Record<string, number>,
    rawOverrides: unknown,
  ): NearTermExpenseAssumption[] {
    if (baseYear == null) return [];
    const explicit = new Map(
      this.extractExplicitNearTermExpenseAssumptions(
        baseYear,
        rawOverrides,
      ).map((row) => [row.year, row]),
    );
    const defaultPersonnelPct = this.round2(
      this.toNumber(assumptions.henkilostokerroin) * 100,
    );
    const defaultEnergyPct = this.round2(
      this.toNumber(assumptions.energiakerroin) * 100,
    );
    const defaultOpexOtherPct = this.round2(
      this.toNumber(assumptions.inflaatio) * 100,
    );

    const out: NearTermExpenseAssumption[] = [];
    for (let year = baseYear; year <= baseYear + 3; year += 1) {
      const row = explicit.get(year);
      out.push({
        year,
        personnelPct: row?.personnelPct ?? defaultPersonnelPct,
        energyPct: row?.energyPct ?? defaultEnergyPct,
        opexOtherPct: row?.opexOtherPct ?? defaultOpexOtherPct,
      });
    }
    return out;
  }

  private async mapScenarioPayload(
    orgId: string,
    projection: any,
  ): Promise<ScenarioPayload> {
    const years: ScenarioYear[] = (projection?.vuodet ?? []).map(
      (row: any): ScenarioYear => {
        const waterDrivers = this.extractWaterDriverPrices(
          row?.erittelyt?.ajurit ?? [],
        );
        const cashflow =
          typeof row?.kassafloede === 'number'
            ? row.kassafloede
            : this.toNumber(row?.tulos) -
              this.toNumber(row?.investoinnitYhteensa);
        const cumulativeCashflow =
          typeof row?.ackumuleradKassa === 'number' ? row.ackumuleradKassa : 0;

        return {
          year: Number(row.vuosi),
          revenue: this.toNumber(row.tulotYhteensa),
          costs: this.toNumber(row.kulutYhteensa),
          result: this.toNumber(row.tulos),
          investments: this.toNumber(row.investoinnitYhteensa),
          combinedPrice: this.toNumber(row.vesihinta),
          soldVolume: this.toNumber(row.myytyVesimaara),
          cashflow: this.round2(cashflow),
          cumulativeCashflow: this.round2(cumulativeCashflow),
          waterPrice: waterDrivers.water,
          wastewaterPrice: waterDrivers.wastewater,
        };
      },
    );

    const baseYear = projection?.talousarvio?.vuosi ?? years[0]?.year ?? null;
    const baselinePriceTodayCombined = years[0]?.combinedPrice ?? null;
    const requiredPriceTodayCombined =
      typeof projection?.requiredTariff === 'number'
        ? projection.requiredTariff
        : null;

    const annualRiseFromPath =
      years.length >= 2 && years[0].combinedPrice > 0
        ? (years[1].combinedPrice / years[0].combinedPrice - 1) * 100
        : null;

    const requiredRiseFromBaseline =
      baselinePriceTodayCombined != null &&
      baselinePriceTodayCombined > 0 &&
      requiredPriceTodayCombined != null &&
      requiredPriceTodayCombined >= 0
        ? Math.max(
            0,
            (requiredPriceTodayCombined / baselinePriceTodayCombined - 1) * 100,
          )
        : null;

    const requiredAnnualIncreasePct =
      requiredRiseFromBaseline ?? annualRiseFromPath;

    const assumptionDefaults = await this.prisma.olettamus.findMany({
      where: { orgId },
      select: { avain: true, arvo: true },
    });

    const assumptions: Record<string, number> = {};
    for (const row of assumptionDefaults) {
      assumptions[row.avain] = this.toNumber(row.arvo);
    }
    for (const [key, value] of Object.entries(
      (projection?.olettamusYlikirjoitukset ?? {}) as Record<string, unknown>,
    )) {
      assumptions[key] = this.toNumber(value);
    }

    const yearlyInvestments = this.buildYearlyInvestments(projection, baseYear);
    const nearTermExpenseAssumptions = this.buildNearTermExpenseAssumptions(
      baseYear,
      assumptions,
      projection?.vuosiYlikirjoitukset ?? {},
    );

    return {
      id: projection.id,
      name: this.normalizeText(projection.nimi) ?? projection.nimi,
      onOletus: Boolean(projection.onOletus),
      talousarvioId: projection.talousarvioId,
      baselineYear: baseYear,
      horizonYears: this.toNumber(projection.aikajaksoVuosia),
      assumptions,
      yearlyInvestments,
      nearTermExpenseAssumptions,
      requiredPriceTodayCombined,
      baselinePriceTodayCombined,
      requiredAnnualIncreasePct,
      years,
      priceSeries: years.map((item) => ({
        year: item.year,
        combinedPrice: item.combinedPrice,
        waterPrice: item.waterPrice,
        wastewaterPrice: item.wastewaterPrice,
      })),
      investmentSeries: years.map((item) => ({
        year: item.year,
        amount: item.investments,
      })),
      cashflowSeries: years.map((item) => ({
        year: item.year,
        cashflow: item.cashflow,
        cumulativeCashflow: item.cumulativeCashflow,
      })),
      updatedAt: projection.updatedAt,
      createdAt: projection.createdAt,
    };
  }

  private extractWaterDriverPrices(rows: Array<Record<string, unknown>>) {
    let water = 0;
    let wastewater = 0;
    for (const row of rows) {
      const service = String(row.palvelutyyppi ?? '');
      const price = this.toNumber(row.yksikkohinta);
      if (service === 'vesi') water = price;
      if (service === 'jatevesi') wastewater = price;
    }
    return { water, wastewater };
  }

  private buildYearlyInvestments(
    projection: any,
    baseYear: number | null,
  ): YearlyInvestment[] {
    if (!baseYear) return [];

    const horizon = Math.max(0, Number(projection?.aikajaksoVuosia ?? 0));
    const items: Record<number, number> = {};

    const userInvestments = Array.isArray(projection?.userInvestments)
      ? (projection.userInvestments as Array<{ year: number; amount: number }>)
      : [];

    for (const item of userInvestments) {
      const year = Math.round(Number(item.year));
      const amount = this.toNumber(item.amount);
      if (Number.isFinite(year)) {
        items[year] = amount;
      }
    }

    const overrides = this.normalizeYearOverrides(
      projection?.vuosiYlikirjoitukset ?? {},
    );
    for (const [yearKey, value] of Object.entries(overrides)) {
      const year = Number(yearKey);
      const amount = this.toNumber(value?.investmentEur);
      if (Number.isFinite(year) && amount > 0) {
        items[year] = amount;
      }
    }

    const rows: YearlyInvestment[] = [];
    for (let offset = 0; offset <= horizon; offset += 1) {
      const year = baseYear + offset;
      rows.push({
        year,
        amount: this.round2(items[year] ?? 0),
      });
    }

    return rows;
  }

  private resolveLatestDataIndex(points: TrendPoint[]): number {
    if (points.length === 0) return -1;
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index]!;
      if (
        this.toNumber(point.revenue) !== 0 ||
        this.toNumber(point.costs) !== 0 ||
        this.toNumber(point.result) !== 0 ||
        this.toNumber(point.volume) !== 0
      ) {
        return index;
      }
    }
    return points.length - 1;
  }

  private resolveLatestComparableYear(
    years:
      | Array<{
          vuosi: number;
          completeness?: {
            tilinpaatos?: boolean;
            volume_vesi?: boolean;
            volume_jatevesi?: boolean;
          };
        }>
      | undefined,
  ): number | null {
    if (!Array.isArray(years) || years.length === 0) return null;
    let latestComplete: number | null = null;
    let latestWithTilinpaatos: number | null = null;
    for (const row of years) {
      const year = Number(row?.vuosi);
      if (!Number.isFinite(year)) continue;
      const hasTilinpaatos = row?.completeness?.tilinpaatos === true;
      const hasVolume =
        row?.completeness?.volume_vesi === true ||
        row?.completeness?.volume_jatevesi === true;

      if (
        hasTilinpaatos &&
        (latestWithTilinpaatos == null || year > latestWithTilinpaatos)
      ) {
        latestWithTilinpaatos = year;
      }
      if (
        hasTilinpaatos &&
        hasVolume &&
        (latestComplete == null || year > latestComplete)
      ) {
        latestComplete = year;
      }
    }
    return latestComplete ?? latestWithTilinpaatos;
  }

  private async getSnapshotFallbackSeries(
    orgId: string,
  ): Promise<Map<number, SnapshotTrendPoint>> {
    const yearRows = await this.veetiEffectiveDataService.getAvailableYears(
      orgId,
    );
    const years = yearRows.map((row) => row.vuosi);
    const out = new Map<number, SnapshotTrendPoint>();

    for (const year of years.sort((a, b) => a - b)) {
      const [tilin, taksa, water, wastewater] = await Promise.all([
        this.veetiEffectiveDataService.getEffectiveRows(
          orgId,
          year,
          'tilinpaatos',
        ),
        this.veetiEffectiveDataService.getEffectiveRows(orgId, year, 'taksa'),
        this.veetiEffectiveDataService.getEffectiveRows(
          orgId,
          year,
          'volume_vesi',
        ),
        this.veetiEffectiveDataService.getEffectiveRows(
          orgId,
          year,
          'volume_jatevesi',
        ),
      ]);

      const tilinRow = tilin.rows[0] ?? null;
      if (!tilinRow) continue;
      const taksaRows = taksa.rows;
      const waterRows = water.rows;
      const wastewaterRows = wastewater.rows;

      const revenue = this.toNumber(tilinRow?.Liikevaihto);
      const operatingCosts = this.round2(
        this.toNumber(tilinRow?.Henkilostokulut) +
          this.toNumber(tilinRow?.Poistot) +
          this.toNumber(tilinRow?.LiiketoiminnanMuutKulut) +
          this.toNumber(tilinRow?.Arvonalentumiset),
      );
      const financingNet = this.round2(
        this.toNumber(tilinRow?.RahoitustuototJaKulut),
      );
      const explicitResult = this.toNumber(tilinRow?.TilikaudenYliJaama);
      const result =
        explicitResult !== 0
          ? explicitResult
          : this.round2(revenue - operatingCosts + financingNet);
      const waterVolume = waterRows.reduce(
        (sum, row) => sum + this.toNumber(row.Maara),
        0,
      );
      const wastewaterVolume = wastewaterRows.reduce(
        (sum, row) => sum + this.toNumber(row.Maara),
        0,
      );
      const totalVolume = waterVolume + wastewaterVolume;
      const waterPrice = this.resolveLatestPrice(taksaRows, 1);
      const wastewaterPrice = this.resolveLatestPrice(taksaRows, 2);
      const combinedPrice = this.round2(
        totalVolume > 0
          ? (waterPrice * waterVolume + wastewaterPrice * wastewaterVolume) /
              totalVolume
          : this.round2((waterPrice + wastewaterPrice) / 2),
      );

      out.set(year, {
        year,
        revenue: this.round2(revenue),
        operatingCosts,
        financingNet,
        otherResultItems: this.round2(revenue - operatingCosts - result),
        yearResult: this.round2(result),
        costs: operatingCosts,
        result: this.round2(result),
        volume: this.round2(totalVolume),
        combinedPrice,
      });
    }

    return out;
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

  private readFirstRecord(
    raw: Prisma.JsonValue | undefined,
  ): Record<string, unknown> | null {
    const rows = this.readRows(raw);
    return rows[0] ?? null;
  }

  private resolveLatestPrice(
    rows: Array<Record<string, unknown>>,
    typeId: number,
  ): number {
    const candidates = rows
      .filter((row) => this.toNumber(row.Tyyppi_Id) === typeId)
      .map((row) => this.toNumber(row.Kayttomaksu))
      .filter((value) => value > 0);
    return candidates[candidates.length - 1] ?? 0;
  }

  private normalizeText(value: string | null | undefined): string | null {
    if (value == null) return null;
    let out = value;

    if (/\\u[0-9a-fA-F]{4}/.test(out)) {
      out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) => {
        const codePoint = Number.parseInt(hex, 16);
        return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : '';
      });
    }

    if (/[ÃÂâ]/.test(out)) {
      const recovered = Buffer.from(out, 'latin1').toString('utf8');
      if (this.looksRecoveredText(recovered, out)) {
        out = recovered;
      }
    }

    return out;
  }

  private looksRecoveredText(candidate: string, original: string): boolean {
    const badPattern = /Ã|Â|â/;
    if (badPattern.test(candidate)) return false;
    const candidateScore = (candidate.match(/[A-Za-z0-9\u00C0-\u017F]/g) ?? [])
      .length;
    const originalScore = (original.match(/[A-Za-z0-9\u00C0-\u017F]/g) ?? [])
      .length;
    return candidateScore >= originalScore;
  }
}
