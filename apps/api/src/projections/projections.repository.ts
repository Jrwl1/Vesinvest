import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../repositories/base.repository';
import type { DriverPaths } from './driver-paths';
import type { ProjectionYearOverrides } from './year-overrides';

@Injectable()
export class ProjectionsRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ── Ennuste (Projection) ──

  findAll(orgId: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.ennuste.findMany({
      where: { orgId: org },
      orderBy: { createdAt: 'desc' },
      include: {
        talousarvio: { select: { id: true, vuosi: true, nimi: true } },
        _count: { select: { vuodet: true } },
      },
    });
  }

  findById(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.ennuste.findFirst({
      where: { id, orgId: org },
      include: {
        talousarvio: {
          include: {
            rivit: { orderBy: [{ tyyppi: 'asc' }, { tiliryhma: 'asc' }] },
            tuloajurit: { orderBy: { palvelutyyppi: 'asc' } },
            valisummat: { orderBy: [{ palvelutyyppi: 'asc' }, { categoryKey: 'asc' }] },
          },
        },
        vuodet: { orderBy: { vuosi: 'asc' } },
      },
    });
  }

  create(orgId: string, data: {
    talousarvioId: string;
    nimi: string;
    aikajaksoVuosia: number;
    olettamusYlikirjoitukset?: Record<string, number>;
    ajuriPolut?: DriverPaths;
    userInvestments?: Array<{ year: number; amount: number }>;
    vuosiYlikirjoitukset?: ProjectionYearOverrides;
  }) {
    const org = this.requireOrgId(orgId);
    return this.prisma.ennuste.create({
      data: {
        orgId: org,
        talousarvioId: data.talousarvioId,
        nimi: data.nimi,
        aikajaksoVuosia: data.aikajaksoVuosia,
        olettamusYlikirjoitukset: data.olettamusYlikirjoitukset ?? undefined,
        ajuriPolut: (data.ajuriPolut as Prisma.InputJsonValue | undefined) ?? undefined,
        userInvestments: (data.userInvestments as Prisma.InputJsonValue | undefined) ?? undefined,
        vuosiYlikirjoitukset: (data.vuosiYlikirjoitukset as Prisma.InputJsonValue | undefined) ?? undefined,
      } as any,
      include: {
        talousarvio: { select: { id: true, vuosi: true, nimi: true } },
        vuodet: { orderBy: { vuosi: 'asc' } },
      },
    });
  }

  async update(orgId: string, id: string, data: {
    nimi?: string;
    aikajaksoVuosia?: number;
    olettamusYlikirjoitukset?: Record<string, number>;
    ajuriPolut?: DriverPaths;
    userInvestments?: Array<{ year: number; amount: number }>;
    vuosiYlikirjoitukset?: ProjectionYearOverrides;
    onOletus?: boolean;
  }) {
    const org = this.requireOrgId(orgId);
    const payload: Record<string, unknown> = {};
    if (data.nimi !== undefined) payload.nimi = data.nimi;
    if (data.aikajaksoVuosia !== undefined) payload.aikajaksoVuosia = data.aikajaksoVuosia;
    if (data.olettamusYlikirjoitukset !== undefined) payload.olettamusYlikirjoitukset = data.olettamusYlikirjoitukset;
    if (data.onOletus !== undefined) payload.onOletus = data.onOletus;
    if (data.ajuriPolut !== undefined) payload.ajuriPolut = data.ajuriPolut as Prisma.InputJsonValue;
    if (data.userInvestments !== undefined) payload.userInvestments = data.userInvestments as Prisma.InputJsonValue;
    if (data.vuosiYlikirjoitukset !== undefined) payload.vuosiYlikirjoitukset = data.vuosiYlikirjoitukset as Prisma.InputJsonValue;
    const result = await this.prisma.ennuste.updateMany({ where: { id, orgId: org }, data: payload });
    if (result.count === 0) throw new NotFoundException('Projection not found');
    return this.findById(org, id);
  }

  async delete(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    // EnnusteVuosi has onDelete: Cascade, so years are auto-deleted
    const result = await this.prisma.ennuste.deleteMany({ where: { id, orgId: org } });
    if (result.count === 0) throw new NotFoundException('Projection not found');
    return { deleted: true };
  }

  // ── EnnusteVuosi (Projection Year) ──

  /**
   * Replace all computed years for a projection with fresh data.
   * Uses a transaction to delete + create atomically.
   */
  async replaceYears(ennusteId: string, years: Array<{
    vuosi: number;
    tulotYhteensa: number;
    kulutYhteensa: number;
    investoinnitYhteensa: number;
    poistoPerusta?: number;
    poistoInvestoinneista?: number;
    tulos: number;
    kumulatiivinenTulos: number;
    vesihinta?: number;
    myytyVesimaara?: number;
    erittelyt?: any;
  }>) {
    return this.prisma.$transaction(async (tx) => {
      await tx.ennusteVuosi.deleteMany({ where: { ennusteId } });

      const created = [];
      for (const y of years) {
        const row = await tx.ennusteVuosi.create({
          data: {
            ennusteId,
            vuosi: y.vuosi,
            tulotYhteensa: y.tulotYhteensa,
            kulutYhteensa: y.kulutYhteensa,
            investoinnitYhteensa: y.investoinnitYhteensa,
            poistoPerusta: y.poistoPerusta,
            poistoInvestoinneista: y.poistoInvestoinneista,
            tulos: y.tulos,
            kumulatiivinenTulos: y.kumulatiivinenTulos,
            vesihinta: y.vesihinta,
            myytyVesimaara: y.myytyVesimaara,
            erittelyt: y.erittelyt ?? undefined,
          },
        });
        created.push(row);
      }

      return created;
    });
  }

  /**
   * Verify that a budget belongs to the org.
   */
  async requireBudgetOwnership(orgId: string, budgetId: string) {
    const org = this.requireOrgId(orgId);
    const budget = await this.prisma.talousarvio.findFirst({
      where: { id: budgetId, orgId: org },
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }
}
