import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../repositories/base.repository';

@Injectable()
export class BudgetsRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ── Talousarvio (Budget) ──

  findAll(orgId: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.talousarvio.findMany({
      where: { orgId: org },
      orderBy: { vuosi: 'desc' },
      include: { _count: { select: { rivit: true, tuloajurit: true } } },
    });
  }

  findById(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.talousarvio.findFirst({
      where: { id, orgId: org },
      include: {
        rivit: { orderBy: [{ tyyppi: 'asc' }, { tiliryhma: 'asc' }] },
        tuloajurit: { orderBy: { palvelutyyppi: 'asc' } },
        valisummat: { orderBy: [{ palvelutyyppi: 'asc' }, { categoryKey: 'asc' }] },
      },
    });
  }

  /** List distinct import batch ids for org (KVA 3-year sets). Returns batch id + representative id + year range for selector. */
  async findBudgetSets(orgId: string) {
    const org = this.requireOrgId(orgId);
    const rows = await this.prisma.talousarvio.findMany({
      where: { orgId: org, importBatchId: { not: null } },
      select: { importBatchId: true, id: true, vuosi: true, nimi: true },
      orderBy: { importedAt: 'desc' },
    });
    const byBatch = new Map<string, { id: string; vuosi: number; nimi: string; vuosit: number[] }>();
    for (const r of rows) {
      if (!r.importBatchId) continue;
      const existing = byBatch.get(r.importBatchId);
      if (existing) {
        existing.vuosit.push(r.vuosi);
      } else {
        byBatch.set(r.importBatchId, { id: r.id, vuosi: r.vuosi, nimi: r.nimi, vuosit: [r.vuosi] });
      }
    }
    return Array.from(byBatch.entries()).map(([batchId, b]) => ({
      batchId,
      id: b.id,
      vuosi: b.vuosi,
      nimi: b.nimi,
      minVuosi: Math.min(...b.vuosit),
      maxVuosi: Math.max(...b.vuosit),
    }));
  }

  /** Get all budgets in a batch (3 year cards). Sorted by vuosi ascending (oldest first). */
  async findBudgetsByBatchId(orgId: string, batchId: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.talousarvio.findMany({
      where: { orgId: org, importBatchId: batchId },
      orderBy: { vuosi: 'asc' },
      include: {
        valisummat: { orderBy: [{ palvelutyyppi: 'asc' }, { categoryKey: 'asc' }] },
        _count: { select: { rivit: true, tuloajurit: true } },
      },
    });
  }

  create(orgId: string, data: { vuosi: number; nimi?: string; perusmaksuYhteensa?: number; importBatchId?: string }) {
    const org = this.requireOrgId(orgId);
    return this.prisma.talousarvio.create({
      data: {
        orgId: org,
        vuosi: data.vuosi,
        nimi: data.nimi ?? `Talousarvio ${data.vuosi}`,
        tila: 'luonnos',
        ...(data.perusmaksuYhteensa !== undefined && { perusmaksuYhteensa: data.perusmaksuYhteensa }),
        ...(data.importBatchId != null && data.importBatchId !== '' && { importBatchId: data.importBatchId }),
      },
      include: { rivit: true, tuloajurit: true },
    });
  }

  async update(orgId: string, id: string, data: {
    nimi?: string;
    tila?: 'luonnos' | 'vahvistettu';
    perusmaksuYhteensa?: number;
  }) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.talousarvio.updateMany({
      where: { id, orgId: org },
      data: {
        ...(data.nimi !== undefined && { nimi: data.nimi }),
        ...(data.tila !== undefined && { tila: data.tila }),
        ...(data.perusmaksuYhteensa !== undefined && { perusmaksuYhteensa: data.perusmaksuYhteensa }),
      },
    });
    if (result.count === 0) throw new NotFoundException('Budget not found');
    return this.findById(org, id);
  }

  async delete(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.talousarvio.deleteMany({ where: { id, orgId: org } });
    if (result.count === 0) throw new NotFoundException('Budget not found');
    return { deleted: true };
  }

  // ── TalousarvioRivi (Budget Line) ──

  async createLine(orgId: string, budgetId: string, data: {
    tiliryhma: string; nimi: string; tyyppi: 'kulu' | 'tulo' | 'investointi'; summa: number; muistiinpanot?: string;
  }) {
    // Verify budget belongs to org
    await this.requireBudgetOwnership(orgId, budgetId);
    return this.prisma.talousarvioRivi.create({
      data: { talousarvioId: budgetId, ...data },
    });
  }

  async updateLine(orgId: string, budgetId: string, lineId: string, data: {
    tiliryhma?: string; nimi?: string; tyyppi?: 'kulu' | 'tulo' | 'investointi'; summa?: number; muistiinpanot?: string;
  }) {
    await this.requireBudgetOwnership(orgId, budgetId);
    const result = await this.prisma.talousarvioRivi.updateMany({
      where: { id: lineId, talousarvioId: budgetId },
      data,
    });
    if (result.count === 0) throw new NotFoundException('Budget line not found');
    return this.prisma.talousarvioRivi.findFirst({ where: { id: lineId } });
  }

  async deleteLine(orgId: string, budgetId: string, lineId: string) {
    await this.requireBudgetOwnership(orgId, budgetId);
    const result = await this.prisma.talousarvioRivi.deleteMany({
      where: { id: lineId, talousarvioId: budgetId },
    });
    if (result.count === 0) throw new NotFoundException('Budget line not found');
    return { deleted: true };
  }

  // ── Tuloajuri (Revenue Driver) ──

  async createDriver(orgId: string, budgetId: string, data: {
    palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
    yksikkohinta: number; myytyMaara: number;
    perusmaksu?: number; liittymamaara?: number; alvProsentti?: number; muistiinpanot?: string;
  }) {
    await this.requireBudgetOwnership(orgId, budgetId);
    return this.prisma.tuloajuri.create({
      data: { talousarvioId: budgetId, ...data },
    });
  }

  async updateDriver(orgId: string, budgetId: string, driverId: string, data: {
    palvelutyyppi?: 'vesi' | 'jatevesi' | 'muu';
    yksikkohinta?: number; myytyMaara?: number;
    perusmaksu?: number; liittymamaara?: number; alvProsentti?: number; muistiinpanot?: string;
  }) {
    await this.requireBudgetOwnership(orgId, budgetId);
    const result = await this.prisma.tuloajuri.updateMany({
      where: { id: driverId, talousarvioId: budgetId },
      data,
    });
    if (result.count === 0) throw new NotFoundException('Revenue driver not found');
    return this.prisma.tuloajuri.findFirst({ where: { id: driverId } });
  }

  async deleteDriver(orgId: string, budgetId: string, driverId: string) {
    await this.requireBudgetOwnership(orgId, budgetId);
    const result = await this.prisma.tuloajuri.deleteMany({
      where: { id: driverId, talousarvioId: budgetId },
    });
    if (result.count === 0) throw new NotFoundException('Revenue driver not found');
    return { deleted: true };
  }

  findDriverByPalvelutyyppi(budgetId: string, palvelutyyppi: 'vesi' | 'jatevesi' | 'muu') {
    return this.prisma.tuloajuri.findFirst({
      where: { talousarvioId: budgetId, palvelutyyppi },
    });
  }

  async upsertDriverByPalvelutyyppi(orgId: string, budgetId: string, data: {
    palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
    yksikkohinta: number;
    myytyMaara: number;
    perusmaksu?: number;
    liittymamaara?: number;
    alvProsentti?: number;
    muistiinpanot?: string;
  }) {
    await this.requireBudgetOwnership(orgId, budgetId);
    const existing = await this.findDriverByPalvelutyyppi(budgetId, data.palvelutyyppi);
    const payload = {
      palvelutyyppi: data.palvelutyyppi,
      yksikkohinta: data.yksikkohinta,
      myytyMaara: data.myytyMaara,
      perusmaksu: data.perusmaksu ?? null,
      liittymamaara: data.liittymamaara ?? null,
      alvProsentti: data.alvProsentti ?? null,
      muistiinpanot: data.muistiinpanot ?? null,
    };
    if (existing) {
      await this.prisma.tuloajuri.update({
        where: { id: existing.id },
        data: payload,
      });
      return this.prisma.tuloajuri.findUnique({ where: { id: existing.id } });
    }
    return this.prisma.tuloajuri.create({
      data: { talousarvioId: budgetId, ...payload },
    });
  }

  // ── TalousarvioValisumma (Budget Subtotal) ──

  findValisummat(orgId: string, budgetId: string) {
    // requireBudgetOwnership is called to enforce tenant guard
    return this.requireBudgetOwnership(orgId, budgetId).then(() =>
      this.prisma.talousarvioValisumma.findMany({
        where: { talousarvioId: budgetId },
        orderBy: [{ palvelutyyppi: 'asc' }, { categoryKey: 'asc' }],
      }),
    );
  }

  async upsertValisumma(orgId: string, budgetId: string, data: {
    palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
    categoryKey: string;
    tyyppi: 'tulo' | 'kulu' | 'poisto' | 'rahoitus_tulo' | 'rahoitus_kulu' | 'investointi' | 'tulos';
    summa: number;
    label?: string;
    lahde?: string;
  }) {
    await this.requireBudgetOwnership(orgId, budgetId);
    return this.prisma.talousarvioValisumma.upsert({
      where: {
        talousarvioId_palvelutyyppi_categoryKey: {
          talousarvioId: budgetId,
          palvelutyyppi: data.palvelutyyppi,
          categoryKey: data.categoryKey,
        },
      },
      create: {
        talousarvioId: budgetId,
        palvelutyyppi: data.palvelutyyppi,
        categoryKey: data.categoryKey,
        tyyppi: data.tyyppi,
        summa: data.summa,
        label: data.label ?? null,
        lahde: data.lahde ?? null,
      },
      update: {
        tyyppi: data.tyyppi,
        summa: data.summa,
        label: data.label ?? null,
        lahde: data.lahde ?? null,
      },
    });
  }

  async upsertManyValisummat(orgId: string, budgetId: string, items: Array<{
    palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
    categoryKey: string;
    tyyppi: 'tulo' | 'kulu' | 'poisto' | 'rahoitus_tulo' | 'rahoitus_kulu' | 'investointi' | 'tulos';
    summa: number;
    label?: string;
    lahde?: string;
  }>) {
    await this.requireBudgetOwnership(orgId, budgetId);
    return this.prisma.$transaction(
      items.map((item) =>
        this.prisma.talousarvioValisumma.upsert({
          where: {
            talousarvioId_palvelutyyppi_categoryKey: {
              talousarvioId: budgetId,
              palvelutyyppi: item.palvelutyyppi,
              categoryKey: item.categoryKey,
            },
          },
          create: {
            talousarvioId: budgetId,
            palvelutyyppi: item.palvelutyyppi,
            categoryKey: item.categoryKey,
            tyyppi: item.tyyppi,
            summa: item.summa,
            label: item.label ?? null,
            lahde: item.lahde ?? null,
          },
          update: {
            tyyppi: item.tyyppi,
            summa: item.summa,
            label: item.label ?? null,
            lahde: item.lahde ?? null,
          },
        }),
      ),
    );
  }

  async deleteValisummat(orgId: string, budgetId: string) {
    await this.requireBudgetOwnership(orgId, budgetId);
    return this.prisma.talousarvioValisumma.deleteMany({
      where: { talousarvioId: budgetId },
    });
  }

  /** Update a single valisumma's summa (for post-import or manual edit). */
  async updateValisummaSumma(orgId: string, budgetId: string, valisummaId: string, summa: number) {
    await this.requireBudgetOwnership(orgId, budgetId);
    const existing = await this.prisma.talousarvioValisumma.findFirst({
      where: { id: valisummaId, talousarvioId: budgetId },
    });
    if (!existing) throw new Error('Valisumma not found');
    return this.prisma.talousarvioValisumma.update({
      where: { id: valisummaId },
      data: { summa },
    });
  }

  // ── KVA Import Confirm (atomic) ──

  /**
   * Find budget by org, year, and name. Used for upsert strategy.
   */
  findBudgetByOrgYearName(orgId: string, vuosi: number, nimi: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.talousarvio.findFirst({
      where: { orgId: org, vuosi, nimi },
    });
  }

  /**
   * Create or update a budget profile with subtotals in one transaction.
   * Uses (orgId, vuosi, nimi) as unique key: if exists, replaces valisummat; otherwise creates new budget.
   * Budget naming rule: use provided nimi for the chosen org.
   */
  async confirmKvaImport(orgId: string, data: {
    vuosi: number;
    nimi: string;
    importBatchId?: string;
    importSourceFileName?: string;
    subtotalLines: Array<{
      palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
      categoryKey: string;
      tyyppi: 'tulo' | 'kulu' | 'poisto' | 'rahoitus_tulo' | 'rahoitus_kulu' | 'investointi' | 'tulos';
      summa: number;
      label?: string;
      lahde?: string;
    }>;
    revenueDrivers?: Array<{
      palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
      yksikkohinta: number;
      myytyMaara: number;
      perusmaksu?: number;
      liittymamaara?: number;
      alvProsentti?: number;
    }>;
    accountLines?: Array<{
      tiliryhma: string;
      nimi: string;
      tyyppi: 'kulu' | 'tulo' | 'investointi';
      summa: number;
      muistiinpanot?: string;
    }>;
  }) {
    const org = this.requireOrgId(orgId);

    return this.prisma.$transaction(async (tx) => {
      // 1. Find or create budget profile (upsert by orgId, vuosi, nimi)
      let budget = await tx.talousarvio.findFirst({
        where: { orgId: org, vuosi: data.vuosi, nimi: data.nimi },
      });
      const isUpdate = !!budget;
      const now = new Date();
      const batchMeta = {
        importBatchId: data.importBatchId ?? null,
        importSourceFileName: data.importSourceFileName ?? null,
        importedAt: now,
      };
      if (!budget) {
        budget = await tx.talousarvio.create({
          data: {
            orgId: org,
            vuosi: data.vuosi,
            nimi: data.nimi,
            tila: 'luonnos',
            ...batchMeta,
          },
        });
      } else {
        await tx.talousarvio.update({
          where: { id: budget.id },
          data: batchMeta,
        });
        await tx.talousarvioValisumma.deleteMany({
          where: { talousarvioId: budget.id },
        });
      }

      // 2. Persist subtotal lines (exclude result types — they're computed, not inputs)
      // Sign convention Option A (ADR-021): store all amounts as positive; cost/depreciation/investment must be normalized before persist.
      // Preserve hierarchy ordering: sort by level, order so first occurrence per key wins for metadata
      // Dedupe by (palvelutyyppi, categoryKey): DB unique is (talousarvioId, palvelutyyppi, category_key)
      type LineWithMeta = (typeof data.subtotalLines)[0] & { level?: number; order?: number };
      const inputSubtotals = data.subtotalLines
        .filter((s) => s.tyyppi !== 'tulos') as LineWithMeta[];
      const sortedByHierarchy = [...inputSubtotals].sort(
        (a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.order ?? 0) - (b.order ?? 0),
      );
      let subtotalLinesCreated = 0;
      if (sortedByHierarchy.length > 0) {
        const key = (s: LineWithMeta) => `${s.palvelutyyppi}|${s.categoryKey}`;
        const byKey = new Map<string, LineWithMeta & { summa: number }>();
        for (const s of sortedByHierarchy) {
          const k = key(s);
          const summa = Number(s.summa);
          if (byKey.has(k)) {
            byKey.get(k)!.summa += summa;
          } else {
            byKey.set(k, { ...s, summa });
          }
        }
        subtotalLinesCreated = byKey.size;
        const orderedValues = Array.from(byKey.values());
        await tx.talousarvioValisumma.createMany({
          data: orderedValues.map((s) => ({
            talousarvioId: budget!.id,
            palvelutyyppi: s.palvelutyyppi,
            categoryKey: s.categoryKey,
            tyyppi: s.tyyppi,
            summa: Math.abs(s.summa),
            label: s.label ?? null,
            lahde: s.lahde ?? null,
            createdAt: now,
            updatedAt: now,
          })),
        });
      }

      // 3. KVA flow: totals-only. No revenue drivers, no account lines (legacy import uses importConfirm).
      const driversCreated = 0;
      const accountLinesCreated = 0;

      return {
        success: true,
        budgetId: budget.id,
        created: {
          subtotalLines: subtotalLinesCreated,
          revenueDrivers: driversCreated,
          accountLines: accountLinesCreated,
        },
      };
    });
  }

  // ── Helpers ──

  private async requireBudgetOwnership(orgId: string, budgetId: string) {
    const org = this.requireOrgId(orgId);
    const budget = await this.prisma.talousarvio.findFirst({ where: { id: budgetId, orgId: org } });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }
}
