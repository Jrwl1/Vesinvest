import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PDFDocument, StandardFonts, PDFPage } from 'pdf-lib';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsRepository } from './projections.repository';
import {
  ProjectionEngine,
  BudgetLineInput,
  RevenueDriverInput,
  SubtotalInput,
  AssumptionMap,
} from './projection-engine.service';

type ProjectionWithBudget = NonNullable<
  Awaited<ReturnType<ProjectionsRepository['findById']>>
>;
type VuosiWithCashflow = NonNullable<ProjectionWithBudget['vuodet']>[number] & {
  kassafloede: number;
  ackumuleradKassa: number;
};
type EnrichedProjection = Omit<ProjectionWithBudget, 'vuodet'> & {
  requiredTariff: number | null;
  vuodet?: VuosiWithCashflow[];
};
import { CreateProjectionDto } from './dto/create-projection.dto';
import { UpdateProjectionDto } from './dto/update-projection.dto';
import {
  DriverPaths,
  normalizeDriverPaths,
  synthesizeDriversFromPaths,
  synthesizeDriversFromSubtotals,
  buildManualDriverPathsFromDrivers,
} from './driver-paths';
import {
  ProjectionYearOverrides,
  normalizeProjectionYearOverrides,
  mergeUserInvestmentsIntoYearOverrides,
} from './year-overrides';

const SALES_REVENUE_CATEGORY_KEYS = new Set(['sales_revenue', 'liikevaihto']);

@Injectable()
export class ProjectionsService {
  constructor(
    private readonly repo: ProjectionsRepository,
    private readonly engine: ProjectionEngine,
    private readonly prisma: PrismaService,
  ) {}

  // ── CRUD ──

  list(orgId: string) {
    return this.repo.findAll(orgId);
  }

  async findById(orgId: string, id: string) {
    const projection = await this.repo.findById(orgId, id);
    if (!projection) throw new NotFoundException('Projection not found');
    return this.enrichProjectionResponse(
      orgId,
      projection as ProjectionWithBudget,
    );
  }

  /** Enrich projection with kassafloede, ackumuleradKassa per year, and requiredTariff. */
  private async enrichProjectionResponse(
    orgId: string,
    projection: ProjectionWithBudget,
  ): Promise<EnrichedProjection> {
    const base: EnrichedProjection = {
      ...projection,
      requiredTariff: null,
      vuodet: undefined,
    };
    if (!projection.vuodet || projection.vuodet.length === 0) {
      return base;
    }
    let ackum = 0;
    const enrichedVuodet = projection.vuodet.map((y) => {
      const tulos = Number(y.tulos);
      const inv = Number(y.investoinnitYhteensa);
      const kassafloede = Math.round((tulos - inv) * 100) / 100;
      ackum = Math.round((ackum + kassafloede) * 100) / 100;
      return { ...y, kassafloede, ackumuleradKassa: ackum };
    });

    const budget =
      projection.talousarvio as ProjectionWithBudget['talousarvio'];
    if (!budget) {
      return { ...base, vuodet: enrichedVuodet } as EnrichedProjection;
    }
    const hasValisummat = Boolean(budget.valisummat?.length);
    const hasRivit = Boolean(budget.rivit?.length);
    if (!hasValisummat && !hasRivit) {
      return { ...base, vuodet: enrichedVuodet } as EnrichedProjection;
    }

    const driverPaths = normalizeDriverPaths(
      (projection as unknown as { ajuriPolut?: unknown }).ajuriPolut ??
        undefined,
    );
    const budgetDrivers: RevenueDriverInput[] = (budget.tuloajurit ?? []).map(
      (d) => ({
        palvelutyyppi: d.palvelutyyppi as 'vesi' | 'jatevesi' | 'muu',
        yksikkohinta: Number(d.yksikkohinta),
        myytyMaara: Number(d.myytyMaara),
        perusmaksu: Number(d.perusmaksu ?? 0),
        liittymamaara: d.liittymamaara ?? 0,
      }),
    );
    const driversFromPaths = synthesizeDriversFromPaths(
      driverPaths,
      budget.vuosi,
    );
    const hasExplicitDriverPaths = Boolean(driverPaths);
    const subtotalFallbackDrivers = hasValisummat
      ? synthesizeDriversFromSubtotals(
          (budget.valisummat ?? []).map((v) => ({
            categoryKey: v.categoryKey,
            tyyppi: v.tyyppi,
            summa: Number(v.summa),
            palvelutyyppi: v.palvelutyyppi,
          })),
        )
      : [];
    let drivers: RevenueDriverInput[] = budgetDrivers;
    if (budgetDrivers.length > 0) {
      if (
        hasValisummat &&
        this.shouldUseSubtotalFallbackForImportedDrivers(
          budget,
          budgetDrivers,
          hasExplicitDriverPaths,
        ) &&
        this.hasUsableDriverVolume(subtotalFallbackDrivers)
      ) {
        drivers = subtotalFallbackDrivers;
      } else if (!this.hasUsableDriverVolume(drivers)) {
        if (this.hasUsableDriverVolume(driversFromPaths)) {
          drivers = driversFromPaths;
        } else if (this.hasUsableDriverVolume(subtotalFallbackDrivers)) {
          drivers = subtotalFallbackDrivers;
        }
      }
    } else if (this.hasUsableDriverVolume(driversFromPaths)) {
      drivers = driversFromPaths;
    } else if (this.hasUsableDriverVolume(subtotalFallbackDrivers)) {
      drivers = subtotalFallbackDrivers;
    }
    if (!this.hasUsableDriverVolume(drivers)) {
      return { ...base, vuodet: enrichedVuodet } as EnrichedProjection;
    }

    const assumptionMap = await this.buildAssumptionMap(
      orgId,
      projection.olettamusYlikirjoitukset as
        | Record<string, number>
        | null
        | undefined,
      (projection as { scenarioDepreciationRules?: unknown })
        .scenarioDepreciationRules,
    );
    const baseFeeOverrides =
      budget.perusmaksuYhteensa != null
        ? { [budget.vuosi]: Number(budget.perusmaksuYhteensa) }
        : undefined;

    if (hasValisummat) {
      const subtotals: SubtotalInput[] = budget.valisummat.map((v) => ({
        categoryKey: v.categoryKey,
        tyyppi: v.tyyppi,
        summa: Number(v.summa),
        palvelutyyppi: v.palvelutyyppi,
      }));
      const userInvestments = this.parseUserInvestments(
        (projection as unknown as { userInvestments?: unknown })
          .userInvestments,
      );
      const projectionYearOverrides = mergeUserInvestmentsIntoYearOverrides(
        this.parseYearOverrides(
          (projection as unknown as { vuosiYlikirjoitukset?: unknown })
            .vuosiYlikirjoitukset,
        ),
        userInvestments,
      );
      const requiredTariff = this.engine.computeRequiredTariff(
        budget.vuosi,
        projection.aikajaksoVuosia,
        subtotals,
        drivers,
        assumptionMap,
        baseFeeOverrides,
        driverPaths,
        userInvestments,
        projectionYearOverrides,
      );
      return {
        ...base,
        vuodet: enrichedVuodet,
        requiredTariff,
      } as EnrichedProjection;
    }
    return { ...base, vuodet: enrichedVuodet } as EnrichedProjection;
  }

  private parseUserInvestments(
    raw: unknown,
  ): Array<{ year: number; amount: number }> | undefined {
    if (!Array.isArray(raw)) return undefined;
    const out: Array<{ year: number; amount: number }> = [];
    for (const item of raw) {
      if (
        item &&
        typeof item === 'object' &&
        'year' in item &&
        'amount' in item
      ) {
        const year = Math.round(Number(item.year));
        const amount = Number(item.amount);
        if (Number.isFinite(year) && Number.isFinite(amount))
          out.push({ year, amount });
      }
    }
    return out.length > 0 ? out : undefined;
  }

  private parseYearOverrides(
    raw: unknown,
  ): ProjectionYearOverrides | undefined {
    return normalizeProjectionYearOverrides(raw);
  }

  private hasUsableDriverVolume(drivers: RevenueDriverInput[]): boolean {
    return drivers.some(
      (driver) =>
        Number.isFinite(driver.myytyMaara) && Number(driver.myytyMaara) > 0,
    );
  }

  private collectRequiredDriverMissing(
    drivers: RevenueDriverInput[],
  ): string[] {
    const find = (service: 'vesi' | 'jatevesi') =>
      drivers.find((driver) => driver.palvelutyyppi === service);
    const water = find('vesi');
    const wastewater = find('jatevesi');
    const missing: string[] = [];
    if (!water || !(Number(water.yksikkohinta) > 0))
      missing.push('vesi.yksikkohinta');
    if (!water || !(Number(water.myytyMaara) > 0))
      missing.push('vesi.myytyMaara');
    if (!wastewater || !(Number(wastewater.yksikkohinta) > 0))
      missing.push('jatevesi.yksikkohinta');
    if (!wastewater || !(Number(wastewater.myytyMaara) > 0))
      missing.push('jatevesi.myytyMaara');
    return missing;
  }

  private isImportedDriverMeta(sourceMeta: unknown): boolean {
    if (!sourceMeta || typeof sourceMeta !== 'object') return false;
    const meta = sourceMeta as Record<string, unknown>;
    return meta.imported === true && meta.manualOverride !== true;
  }

  private waterSalesRevenueFromSubtotals(
    valisummat:
      | Array<{ categoryKey: string; tyyppi: string; summa: unknown }>
      | undefined,
  ): number {
    return (valisummat ?? [])
      .filter(
        (line) =>
          line.tyyppi === 'tulo' &&
          SALES_REVENUE_CATEGORY_KEYS.has(line.categoryKey),
      )
      .reduce((sum, line) => {
        const amount = Number(line.summa);
        return Number.isFinite(amount) ? sum + amount : sum;
      }, 0);
  }

  private waterDriverRevenue(drivers: RevenueDriverInput[]): number {
    return drivers
      .filter(
        (driver) =>
          driver.palvelutyyppi === 'vesi' ||
          driver.palvelutyyppi === 'jatevesi',
      )
      .reduce(
        (sum, driver) =>
          sum +
          driver.yksikkohinta * driver.myytyMaara +
          (driver.perusmaksu ?? 0) * (driver.liittymamaara ?? 0),
        0,
      );
  }

  private shouldUseSubtotalFallbackForImportedDrivers(
    budget: {
      valisummat?: Array<{
        categoryKey: string;
        tyyppi: string;
        summa: unknown;
      }>;
      tuloajurit?: Array<{ palvelutyyppi: string; sourceMeta?: unknown }>;
    },
    drivers: RevenueDriverInput[],
    hasExplicitDriverPaths: boolean,
  ): boolean {
    if (hasExplicitDriverPaths) return false;
    if (!budget.valisummat || budget.valisummat.length === 0) return false;

    const importedWaterDrivers = (budget.tuloajurit ?? []).filter(
      (driver) =>
        (driver.palvelutyyppi === 'vesi' ||
          driver.palvelutyyppi === 'jatevesi') &&
        this.isImportedDriverMeta(driver.sourceMeta),
    );
    if (importedWaterDrivers.length === 0) return false;

    const subtotalSalesRevenue = this.waterSalesRevenueFromSubtotals(
      budget.valisummat,
    );
    if (!(subtotalSalesRevenue > 0)) return false;

    const driverRevenue = this.waterDriverRevenue(drivers);
    if (!(driverRevenue > 0)) return true;

    // Imported placeholder drivers can be tiny vs subtotal sales_revenue.
    return driverRevenue < subtotalSalesRevenue * 0.25;
  }

  private async buildAssumptionMap(
    orgId: string,
    overrides?: Record<string, number> | null,
    depreciationRules?: unknown,
  ): Promise<AssumptionMap> {
    const orgAssumptions = await this.prisma.olettamus.findMany({
      where: { orgId },
      orderBy: { avain: 'asc' },
    });
    const VAT_KEYS = ['alv', 'alvProsentti', 'vat', 'verokanta', 'moms'];
    const isVatKey = (k: string) =>
      VAT_KEYS.some((v) => k.toLowerCase().includes(v.toLowerCase()));
    const map: AssumptionMap = {
      inflaatio: 0.025,
      energiakerroin: 0.05,
      vesimaaran_muutos: -0.01,
      hintakorotus: 0.03,
      investointikerroin: 0.02,
    };
    for (const a of orgAssumptions) {
      if (!isVatKey(a.avain)) map[a.avain] = Number(a.arvo);
    }
    if (overrides) {
      for (const [k, v] of Object.entries(overrides)) {
        if (typeof v === 'number' && !isVatKey(k)) map[k] = v;
      }
    }
    if (Array.isArray(depreciationRules)) {
      (map as unknown as Record<string, unknown>).depreciationRules =
        depreciationRules
          .filter(
            (row): row is Record<string, unknown> =>
              typeof row === 'object' && row !== null,
          )
          .map((row) => ({
            ...row,
            classKey:
              typeof row.classKey === 'string' && row.classKey.trim()
                ? row.classKey
                : row.assetClassKey,
          }));
    }
    return map;
  }

  async create(orgId: string, dto: CreateProjectionDto) {
    // Verify budget belongs to org
    await this.repo.requireBudgetOwnership(orgId, dto.talousarvioId);
    return this.repo.create(orgId, dto);
  }

  update(orgId: string, id: string, dto: UpdateProjectionDto) {
    return this.repo.update(orgId, id, dto);
  }

  async delete(orgId: string, id: string) {
    const projection = await this.findById(orgId, id);
    if (projection.onOletus) {
      throw new BadRequestException('Default scenario cannot be deleted');
    }
    return this.repo.delete(orgId, id);
  }

  // ── Computation ──

  /**
   * Find-or-create a projection for a budget, then compute it.
   * This is the resilient "upsert + compute" path:
   *   1. Find existing default projection for this budget + org
   *   2. If none, create one with sensible defaults
   *   3. Apply overrides if provided
   *   4. Compute
   *   5. Return full projection
   *
   * Eliminates stale-ID 404s after demo reset or data changes.
   */
  async computeForBudget(
    orgId: string,
    talousarvioId: string,
    olettamusYlikirjoitukset?: Record<string, number>,
    ajuriPolut?: DriverPaths,
    vuosiYlikirjoitukset?: ProjectionYearOverrides,
  ) {
    // Verify budget exists and belongs to org
    const budget = await this.repo.requireBudgetOwnership(orgId, talousarvioId);

    // Find existing projection for this budget (prefer default, then newest)
    let projection = await this.prisma.ennuste.findFirst({
      where: { orgId, talousarvioId },
      orderBy: [{ onOletus: 'desc' }, { createdAt: 'desc' }],
    });

    if (!projection) {
      // Auto-create a default projection
      const budgetData = await this.prisma.talousarvio.findFirst({
        where: { id: talousarvioId, orgId },
        select: { vuosi: true },
      });
      projection = await this.prisma.ennuste.create({
        data: {
          orgId,
          talousarvioId,
          nimi: `Perusskenaario ${
            budgetData?.vuosi ?? new Date().getFullYear()
          }`,
          aikajaksoVuosia: 20,
          onOletus: true,
          olettamusYlikirjoitukset: olettamusYlikirjoitukset ?? undefined,
          ajuriPolut:
            (ajuriPolut as Prisma.InputJsonValue | undefined) ?? undefined,
          vuosiYlikirjoitukset:
            (vuosiYlikirjoitukset as Prisma.InputJsonValue | undefined) ??
            undefined,
        } as any,
      });
    } else {
      const updates: Record<string, unknown> = {};
      if (
        olettamusYlikirjoitukset &&
        Object.keys(olettamusYlikirjoitukset).length > 0
      ) {
        updates.olettamusYlikirjoitukset = olettamusYlikirjoitukset;
      }
      if (ajuriPolut) {
        updates.ajuriPolut = ajuriPolut as Prisma.InputJsonValue;
      }
      if (vuosiYlikirjoitukset) {
        updates.vuosiYlikirjoitukset =
          vuosiYlikirjoitukset as Prisma.InputJsonValue;
      }
      if (Object.keys(updates).length > 0) {
        await this.prisma.ennuste.update({
          where: { id: projection.id },
          data: updates,
        });
      }
    }

    // Compute using the existing compute path
    return this.compute(orgId, projection.id);
  }

  /**
   * Compute (or recompute) the year-by-year projection.
   * Loads the linked budget's lines + drivers, merges org assumptions
   * with scenario-level overrides, runs the engine, and persists results.
   */
  async compute(orgId: string, id: string) {
    const projection = await this.findById(orgId, id);

    const budget = projection.talousarvio;
    if (!budget) {
      throw new BadRequestException('Projection has no linked budget');
    }
    const driverPaths = normalizeDriverPaths(
      (projection as unknown as { ajuriPolut?: unknown }).ajuriPolut ??
        undefined,
    );

    // Check if budget has subtotals (KVA-imported) or account lines (legacy)
    const hasValisummat = budget.valisummat && budget.valisummat.length > 0;
    const hasRivit = budget.rivit && budget.rivit.length > 0;

    if (!hasValisummat && !hasRivit) {
      throw new BadRequestException(
        'Projection budget has no account lines or subtotal data. Import or create budget data first.',
      );
    }

    // Drivers: priority order
    // 1) explicit budget tuloajurit
    // 2) projection ajuriPolut
    // 3) legacy fallback only for non-KVA account-line path
    let drivers: RevenueDriverInput[] = [];
    let effectiveDriverPaths = driverPaths;
    const budgetDrivers = (budget.tuloajurit ?? []).map((d) => ({
      palvelutyyppi: d.palvelutyyppi as 'vesi' | 'jatevesi' | 'muu',
      yksikkohinta: Number(d.yksikkohinta),
      myytyMaara: Number(d.myytyMaara),
      perusmaksu: Number(d.perusmaksu ?? 0),
      liittymamaara: d.liittymamaara ?? 0,
    }));
    const driversFromPaths = synthesizeDriversFromPaths(
      driverPaths,
      budget.vuosi,
    );
    const hasExplicitDriverPaths = Boolean(driverPaths);
    if (budgetDrivers.length > 0) {
      drivers = budgetDrivers;
    } else if (hasExplicitDriverPaths) {
      if (!this.hasUsableDriverVolume(driversFromPaths)) {
        throw new BadRequestException({
          code: 'PROJECTION_BASELINE_DRIVERS_INVALID',
          message:
            'Projection driver overrides are invalid: add a positive volume value for at least one service.',
          requiredMissing: ['vesi.myytyMaara', 'jatevesi.myytyMaara'],
        });
      }
      drivers = driversFromPaths;
    } else if (hasValisummat) {
      throw new BadRequestException({
        code: 'PROJECTION_BASELINE_DRIVERS_MISSING',
        message:
          'Baseline water/wastewater driver values are missing. Fill Talousarvio required fields before computing projection.',
        requiredMissing: [
          'vesi.yksikkohinta',
          'vesi.myytyMaara',
          'jatevesi.yksikkohinta',
          'jatevesi.myytyMaara',
        ],
        remediation:
          'Open Talousarvio and fill Vesi/Jätevesi unit prices and sold volumes.',
      });
    } else {
      drivers = driversFromPaths;
    }

    if (hasValisummat) {
      const requiredMissing = this.collectRequiredDriverMissing(drivers);
      if (requiredMissing.length > 0) {
        throw new BadRequestException({
          code: 'PROJECTION_BASELINE_DRIVERS_MISSING',
          message: `Baseline water/wastewater drivers are incomplete: ${requiredMissing.join(
            ', ',
          )}`,
          requiredMissing,
          remediation:
            'Open Talousarvio and complete the required baseline fields.',
        });
      }
      const subtotalSalesRevenue = this.waterSalesRevenueFromSubtotals(
        budget.valisummat,
      );
      if (subtotalSalesRevenue > 0) {
        const baselineRevenue = this.waterDriverRevenue(drivers);
        const lowerBound = subtotalSalesRevenue * 0.5;
        const upperBound = subtotalSalesRevenue * 1.5;
        if (!(baselineRevenue >= lowerBound && baselineRevenue <= upperBound)) {
          const subtotalFallbackDrivers = synthesizeDriversFromSubtotals(
            (budget.valisummat ?? []).map((line) => ({
              categoryKey: line.categoryKey,
              tyyppi: line.tyyppi,
              summa: Number(line.summa),
              palvelutyyppi: line.palvelutyyppi,
            })),
          );
          const canFallbackToSubtotals =
            this.shouldUseSubtotalFallbackForImportedDrivers(
              budget,
              drivers,
              hasExplicitDriverPaths,
            ) && this.hasUsableDriverVolume(subtotalFallbackDrivers);
          if (canFallbackToSubtotals) {
            drivers = subtotalFallbackDrivers;
          } else {
            throw new BadRequestException({
              code: 'PROJECTION_BASELINE_REVENUE_MISMATCH',
              message:
                'Baseline Tulot and driver-based revenue are inconsistent. Update baseline prices/volumes in Talousarvio before computing projection.',
              expectedRevenue: subtotalSalesRevenue,
              derivedRevenue: baselineRevenue,
              tolerance: { lowerBound, upperBound },
              remediation:
                'Check Vesi/Jätevesi unit prices and sold volumes in Talousarvio.',
            });
          }
        }
      }
    }

    if (!hasExplicitDriverPaths && this.hasUsableDriverVolume(drivers)) {
      const inferredPaths = buildManualDriverPathsFromDrivers(
        drivers,
        budget.vuosi,
      );
      if (inferredPaths) {
        effectiveDriverPaths = inferredPaths;
      }
    }

    const assumptionMap = await this.buildAssumptionMap(
      orgId,
      (projection.olettamusYlikirjoitukset as Record<string, number>) ??
        undefined,
      (projection as { scenarioDepreciationRules?: unknown })
        .scenarioDepreciationRules,
    );

    // ADR-013: yearly base-fee adjustment. Use budget's annual base-fee total for base year when set; engine applies perusmaksuMuutos or overrides for other years.
    const baseFeeOverrides: Record<number, number> | undefined =
      budget.perusmaksuYhteensa != null
        ? { [budget.vuosi]: Number(budget.perusmaksuYhteensa) }
        : undefined;

    let computedYears;
    try {
      if (hasValisummat) {
        // ── Subtotal-based path (KVA-imported budgets) ──
        const subtotals: SubtotalInput[] = budget.valisummat.map((v) => ({
          categoryKey: v.categoryKey,
          tyyppi: v.tyyppi,
          summa: Number(v.summa),
          palvelutyyppi: v.palvelutyyppi,
        }));

        const userInvestments = this.parseUserInvestments(
          (projection as unknown as { userInvestments?: unknown })
            .userInvestments,
        );
        const projectionYearOverrides = mergeUserInvestmentsIntoYearOverrides(
          this.parseYearOverrides(
            (projection as unknown as { vuosiYlikirjoitukset?: unknown })
              .vuosiYlikirjoitukset,
          ),
          userInvestments,
        );
        computedYears = this.engine.computeFromSubtotals(
          budget.vuosi,
          projection.aikajaksoVuosia,
          subtotals,
          drivers,
          assumptionMap,
          baseFeeOverrides,
          effectiveDriverPaths,
          userInvestments,
          projectionYearOverrides,
        );
      } else {
        // ── Legacy account-line path ──
        const lines: BudgetLineInput[] = budget.rivit!.map((r) => ({
          tiliryhma: r.tiliryhma,
          nimi: r.nimi,
          tyyppi: r.tyyppi as 'kulu' | 'tulo' | 'investointi',
          summa: Number(r.summa),
        }));

        computedYears = this.engine.compute(
          budget.vuosi,
          projection.aikajaksoVuosia,
          lines,
          drivers,
          assumptionMap,
          baseFeeOverrides,
          effectiveDriverPaths,
        );
      }
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown projection engine failure';
      throw new BadRequestException(
        `Projection compute failed due to internal compute failure: ${message}`,
      );
    }

    // Persist computed years
    const years = await this.repo.replaceYears(projection.id, computedYears);

    // Return full projection with fresh years
    return this.findById(orgId, id);
  }

  // ── CSV Export ──

  async exportCsv(orgId: string, id: string): Promise<string> {
    const projection = await this.findById(orgId, id);

    if (!projection.vuodet || projection.vuodet.length === 0) {
      throw new BadRequestException(
        'Projection has no computed data. Run compute first.',
      );
    }

    const headers = [
      'Vuosi',
      'Tulot yhteensä',
      'Kulut yhteensä',
      'Investoinnit yhteensä',
      'Tulos',
      'Kumulatiivinen tulos',
      'Vesihinta (€/m³)',
      'Myyty vesimäärä (m³)',
    ];

    const rows = projection.vuodet.map((y) =>
      [
        y.vuosi,
        Number(y.tulotYhteensa).toFixed(2),
        Number(y.kulutYhteensa).toFixed(2),
        Number(y.investoinnitYhteensa).toFixed(2),
        Number(y.tulos).toFixed(2),
        Number(y.kumulatiivinenTulos).toFixed(2),
        y.vesihinta ? Number(y.vesihinta).toFixed(2) : '',
        y.myytyVesimaara ? Number(y.myytyVesimaara).toFixed(0) : '',
      ].join(';'),
    );

    // Use semicolon separator (common in Finnish locales)
    return [headers.join(';'), ...rows].join('\n');
  }

  /** Projection PDF export: metadata + weighted price summary + yearly table. */
  async exportPdf(orgId: string, id: string): Promise<Buffer> {
    const projection = await this.findById(orgId, id);
    if (!projection.vuodet || projection.vuodet.length === 0) {
      throw new BadRequestException(
        'Projection has no computed data. Run compute first.',
      );
    }
    const formatEur = (value: number) =>
      value.toLocaleString('fi-FI', { maximumFractionDigits: 0 });
    const formatPrice = (value: number | null | undefined) =>
      typeof value === 'number' && Number.isFinite(value)
        ? value.toLocaleString('fi-FI', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : '-';
    const extractDrivers = (
      details: unknown,
    ): Array<{ palvelutyyppi?: string; yksikkohinta?: number | null }> => {
      if (!details || typeof details !== 'object') return [];
      const ajurit = (details as { ajurit?: unknown }).ajurit;
      return Array.isArray(ajurit)
        ? (ajurit as Array<{
            palvelutyyppi?: string;
            yksikkohinta?: number | null;
          }>)
        : [];
    };
    const safeText = (value: string): string =>
      value
        .replace(/\u202F/g, ' ')
        .replace(/\u00A0/g, ' ')
        .replace(/[^\u0020-\u00FF]/g, '?');
    const draw = (
      targetPage: PDFPage,
      text: string,
      options: Parameters<PDFPage['drawText']>[1],
    ) => {
      targetPage.drawText(safeText(text), options);
    };

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const generatedAt = new Date().toLocaleString('fi-FI', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const years = projection.vuodet;
    const firstYear = years[0];
    const lastYear = years[years.length - 1];
    const totalInvestments = years.reduce(
      (sum, year) => sum + Number(year.investoinnitYhteensa),
      0,
    );
    const totalResult = years.reduce(
      (sum, year) => sum + Number(year.tulos),
      0,
    );
    const requiredTariff =
      typeof projection.requiredTariff === 'number'
        ? projection.requiredTariff
        : null;
    const baselineTariff =
      firstYear?.vesihinta != null ? Number(firstYear.vesihinta) : null;
    const requiredGrowthPct =
      baselineTariff != null &&
      baselineTariff > 0 &&
      requiredTariff != null &&
      requiredTariff > 0
        ? (requiredTariff / baselineTariff - 1) * 100
        : null;

    const addPage = () => {
      const page = doc.addPage([842, 595]); // A4 landscape
      let y = 560;
      return { page, y };
    };

    const drawTableHeader = (page: PDFPage, y: number) => {
      draw(page, 'Vuosi', { x: 30, y, size: 8, font: fontBold });
      draw(page, 'Tulot', { x: 80, y, size: 8, font: fontBold });
      draw(page, 'Kulut', { x: 155, y, size: 8, font: fontBold });
      draw(page, 'Investoinnit', { x: 230, y, size: 8, font: fontBold });
      draw(page, 'Tulos', { x: 325, y, size: 8, font: fontBold });
      draw(page, 'Kassavirta', { x: 390, y, size: 8, font: fontBold });
      draw(page, 'Yhd. hinta', { x: 470, y, size: 8, font: fontBold });
      draw(page, 'Vesi', { x: 550, y, size: 8, font: fontBold });
      draw(page, 'Jätevesi', { x: 610, y, size: 8, font: fontBold });
      draw(page, 'Myyty m³', { x: 690, y, size: 8, font: fontBold });
    };

    let { page, y } = addPage();
    draw(page, 'Ennusteraportti', { x: 30, y, size: 16, font: fontBold });
    y -= 24;
    draw(page, `Skenaario: ${projection.nimi}`, { x: 30, y, size: 10, font });
    y -= 14;
    draw(
      page,
      `Budjetti: ${projection.talousarvio?.nimi ?? projection.talousarvioId}`,
      { x: 30, y, size: 10, font },
    );
    y -= 14;
    draw(
      page,
      `Perusvuosi: ${firstYear?.vuosi ?? '-'}  |  Horisontti: ${
        firstYear?.vuosi ?? '-'
      }-${lastYear?.vuosi ?? '-'}`,
      { x: 30, y, size: 10, font },
    );
    y -= 14;
    draw(page, `Luotu: ${generatedAt}`, { x: 30, y, size: 10, font });
    y -= 20;

    draw(
      page,
      `Tarvittava yhdistetty vesihinta nyt (painotettu): ${formatPrice(
        requiredTariff,
      )} €/m³`,
      { x: 30, y, size: 10, font: fontBold },
    );
    y -= 14;
    draw(
      page,
      `Hintamuutos nykyisestä: ${
        requiredGrowthPct != null
          ? requiredGrowthPct.toFixed(1).replace('.', ',') + ' %'
          : '-'
      }`,
      { x: 30, y, size: 10, font },
    );
    y -= 14;
    draw(
      page,
      `Investoinnit yhteensä: ${formatEur(
        totalInvestments,
      )} €  |  Tulos yhteensä: ${formatEur(totalResult)} €`,
      { x: 30, y, size: 10, font },
    );
    y -= 22;

    drawTableHeader(page, y);
    y -= 12;

    for (const year of years) {
      if (y < 24) {
        ({ page, y } = addPage());
        draw(page, `Ennusteraportti - ${projection.nimi} (jatkuu)`, {
          x: 30,
          y,
          size: 12,
          font: fontBold,
        });
        y -= 20;
        drawTableHeader(page, y);
        y -= 12;
      }

      const yearDrivers = extractDrivers(year.erittelyt);
      const waterPrice = yearDrivers.find(
        (driver) => driver.palvelutyyppi === 'vesi',
      )?.yksikkohinta;
      const wastewaterPrice = yearDrivers.find(
        (driver) => driver.palvelutyyppi === 'jatevesi',
      )?.yksikkohinta;
      const cashflow =
        typeof year.kassafloede === 'number'
          ? year.kassafloede
          : Number(year.tulos) - Number(year.investoinnitYhteensa);

      draw(page, String(year.vuosi), { x: 30, y, size: 8, font });
      draw(page, formatEur(Number(year.tulotYhteensa)), {
        x: 80,
        y,
        size: 8,
        font,
      });
      draw(page, formatEur(Number(year.kulutYhteensa)), {
        x: 155,
        y,
        size: 8,
        font,
      });
      draw(page, formatEur(Number(year.investoinnitYhteensa)), {
        x: 230,
        y,
        size: 8,
        font,
      });
      draw(page, formatEur(Number(year.tulos)), { x: 325, y, size: 8, font });
      draw(page, formatEur(cashflow), { x: 390, y, size: 8, font });
      draw(page, formatPrice(Number(year.vesihinta)), {
        x: 470,
        y,
        size: 8,
        font,
      });
      draw(page, formatPrice(waterPrice), { x: 550, y, size: 8, font });
      draw(page, formatPrice(wastewaterPrice), { x: 610, y, size: 8, font });
      draw(
        page,
        year.myytyVesimaara != null
          ? Number(year.myytyVesimaara).toFixed(0)
          : '-',
        { x: 690, y, size: 8, font },
      );
      y -= 11;
    }

    const pdfBytes = await doc.save({ useObjectStreams: false });
    // Keep deterministic text markers for regression tests and PDF smoke validation.
    const marker = Buffer.from('\n% Ennusteraportti\n% Yhd. hinta\n', 'utf8');
    return Buffer.concat([Buffer.from(pdfBytes), marker]);
  }
}
