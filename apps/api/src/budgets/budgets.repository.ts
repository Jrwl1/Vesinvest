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

  create(orgId: string, data: { vuosi: number; nimi?: string }) {
    const org = this.requireOrgId(orgId);
    return this.prisma.talousarvio.create({
      data: { orgId: org, vuosi: data.vuosi, nimi: data.nimi ?? `Talousarvio ${data.vuosi}`, tila: 'luonnos' },
      include: { rivit: true, tuloajurit: true },
    });
  }

  async update(orgId: string, id: string, data: { nimi?: string; tila?: 'luonnos' | 'vahvistettu' }) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.talousarvio.updateMany({ where: { id, orgId: org }, data });
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

  // ── KVA Import Confirm (atomic) ──

  /**
   * Create a budget profile with all associated data in one transaction.
   * Used by the KVA import confirm flow.
   */
  async confirmKvaImport(orgId: string, data: {
    vuosi: number;
    nimi: string;
    subtotalLines: Array<{
      palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
      categoryKey: string;
      tyyppi: 'tulo' | 'kulu' | 'poisto' | 'rahoitus_tulo' | 'rahoitus_kulu' | 'investointi' | 'tulos';
      summa: number;
      label?: string;
      lahde?: string;
    }>;
    revenueDrivers: Array<{
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
      // 1. Create budget profile
      const budget = await tx.talousarvio.create({
        data: {
          orgId: org,
          vuosi: data.vuosi,
          nimi: data.nimi,
          tila: 'luonnos',
        },
      });

      // 2. Persist subtotal lines (exclude result types — they're computed, not inputs)
      // Dedupe by (palvelutyyppi, categoryKey): DB unique is (talousarvioId, palvelutyyppi, category_key)
      const inputSubtotals = data.subtotalLines.filter((s) => s.tyyppi !== 'tulos');
      let subtotalLinesCreated = 0;
      if (inputSubtotals.length > 0) {
        const key = (s: (typeof inputSubtotals)[0]) => `${s.palvelutyyppi}|${s.categoryKey}`;
        const byKey = new Map<string, (typeof inputSubtotals)[0] & { summa: number }>();
        for (const s of inputSubtotals) {
          const k = key(s);
          const summa = Number(s.summa);
          if (byKey.has(k)) {
            byKey.get(k)!.summa += summa;
          } else {
            byKey.set(k, { ...s, summa });
          }
        }
        subtotalLinesCreated = byKey.size;
        const now = new Date();
        await tx.talousarvioValisumma.createMany({
          data: Array.from(byKey.values()).map((s) => ({
            talousarvioId: budget.id,
            palvelutyyppi: s.palvelutyyppi,
            categoryKey: s.categoryKey,
            tyyppi: s.tyyppi,
            summa: s.summa,
            label: s.label ?? null,
            lahde: s.lahde ?? null,
            createdAt: now,
            updatedAt: now,
          })),
        });
      }

      // 3. Persist revenue drivers
      let driversCreated = 0;
      for (const d of data.revenueDrivers) {
        const meaningful =
          (d.yksikkohinta ?? 0) > 0 ||
          (d.myytyMaara ?? 0) > 0 ||
          (d.liittymamaara ?? 0) > 0 ||
          (d.perusmaksu ?? 0) > 0;
        if (!meaningful) continue;
        await tx.tuloajuri.create({
          data: {
            talousarvioId: budget.id,
            palvelutyyppi: d.palvelutyyppi,
            yksikkohinta: d.yksikkohinta,
            myytyMaara: d.myytyMaara,
            perusmaksu: d.perusmaksu ?? null,
            liittymamaara: d.liittymamaara ?? null,
            alvProsentti: d.alvProsentti ?? null,
          },
        });
        driversCreated++;
      }

      // 4. Optionally persist account-level lines
      let accountLinesCreated = 0;
      if (data.accountLines && data.accountLines.length > 0) {
        await tx.talousarvioRivi.createMany({
          data: data.accountLines.map((l) => ({
            talousarvioId: budget.id,
            tiliryhma: l.tiliryhma,
            nimi: l.nimi,
            tyyppi: l.tyyppi,
            summa: l.summa,
            muistiinpanot: l.muistiinpanot ?? null,
          })),
        });
        accountLinesCreated = data.accountLines.length;
      }

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
