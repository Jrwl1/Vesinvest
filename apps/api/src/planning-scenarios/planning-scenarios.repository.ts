import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../repositories/base.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class PlanningScenariosRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAll(orgId: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.planningScenario.findMany({
      where: { orgId: org },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  findById(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.planningScenario.findFirst({
      where: { id, orgId: org },
    });
  }

  findDefault(orgId: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.planningScenario.findFirst({
      where: { orgId: org, isDefault: true },
    });
  }

  async create(
    orgId: string,
    data: {
      name: string;
      planningHorizonYears?: number;
      inflationRate?: number;
      discountRate?: number;
      currentTariffEur?: number;
      revenueBaselineEur?: number;
      isDefault?: boolean;
    },
  ) {
    const org = this.requireOrgId(orgId);

    // If this is being set as default, unset other defaults first
    if (data.isDefault) {
      await this.prisma.planningScenario.updateMany({
        where: { orgId: org, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.planningScenario.create({
      data: {
        orgId: org,
        name: data.name,
        planningHorizonYears: data.planningHorizonYears,
        inflationRate: data.inflationRate ? new Prisma.Decimal(data.inflationRate) : undefined,
        discountRate: data.discountRate ? new Prisma.Decimal(data.discountRate) : undefined,
        currentTariffEur: data.currentTariffEur ? new Prisma.Decimal(data.currentTariffEur) : undefined,
        revenueBaselineEur: data.revenueBaselineEur ? new Prisma.Decimal(data.revenueBaselineEur) : undefined,
        isDefault: data.isDefault,
      },
    });
  }

  async update(
    orgId: string,
    id: string,
    data: {
      name?: string;
      planningHorizonYears?: number;
      inflationRate?: number;
      discountRate?: number;
      currentTariffEur?: number;
      revenueBaselineEur?: number;
      isDefault?: boolean;
    },
  ) {
    const org = this.requireOrgId(orgId);

    // If this is being set as default, unset other defaults first
    if (data.isDefault) {
      await this.prisma.planningScenario.updateMany({
        where: { orgId: org, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: Prisma.PlanningScenarioUpdateInput = {
      name: data.name,
      planningHorizonYears: data.planningHorizonYears,
      isDefault: data.isDefault,
    };

    if (data.inflationRate !== undefined) {
      updateData.inflationRate = new Prisma.Decimal(data.inflationRate);
    }
    if (data.discountRate !== undefined) {
      updateData.discountRate = new Prisma.Decimal(data.discountRate);
    }
    if (data.currentTariffEur !== undefined) {
      updateData.currentTariffEur = new Prisma.Decimal(data.currentTariffEur);
    }
    if (data.revenueBaselineEur !== undefined) {
      updateData.revenueBaselineEur = new Prisma.Decimal(data.revenueBaselineEur);
    }

    const result = await this.prisma.planningScenario.updateMany({
      where: { id, orgId: org },
      data: updateData,
    });

    if (result.count === 0) throw new NotFoundException('Planning scenario not found');
    return this.prisma.planningScenario.findFirst({ where: { id, orgId: org } });
  }

  async delete(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.planningScenario.deleteMany({
      where: { id, orgId: org },
    });
    if (result.count === 0) throw new NotFoundException('Planning scenario not found');
    return { deleted: true };
  }
}
