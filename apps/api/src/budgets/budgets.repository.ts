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

  // ── Helpers ──

  private async requireBudgetOwnership(orgId: string, budgetId: string) {
    const org = this.requireOrgId(orgId);
    const budget = await this.prisma.talousarvio.findFirst({ where: { id: budgetId, orgId: org } });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }
}
