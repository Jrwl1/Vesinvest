import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MaintenanceRepository } from './maintenance.repository';
import { CreateMaintenanceItemDto } from './dto/create-maintenance-item.dto';
import { UpdateMaintenanceItemDto } from './dto/update-maintenance-item.dto';
import { ProjectionQueryDto } from './dto/projection-query.dto';
import {
  ProjectionItemDto,
  ProjectionRowDto,
  ProjectionResultDto,
  ProjectionScenarioDto,
} from './dto/projection-result.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceKind, Prisma } from '@prisma/client';
import { PlanningScenariosService } from '../planning-scenarios/planning-scenarios.service';

type AssetWithRelations = Prisma.AssetGetPayload<{
  include: { assetType: true; maintenanceItems: true };
}>;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly repo: MaintenanceRepository,
    private readonly prisma: PrismaService,
    private readonly scenariosService: PlanningScenariosService,
  ) {}

  list(orgId: string, filters: { assetId?: string; siteId?: string }) {
    return this.repo.findAll(orgId, filters);
  }

  create(orgId: string, dto: CreateMaintenanceItemDto) {
    const data = {
      ...dto,
      costEur: new Prisma.Decimal(dto.costEur),
    };
    return this.repo.create(orgId, data);
  }

  update(orgId: string, id: string, dto: UpdateMaintenanceItemDto) {
    const data: any = { ...dto };
    if (dto.costEur !== undefined) {
      data.costEur = new Prisma.Decimal(dto.costEur);
    }
    return this.repo.update(orgId, id, data);
  }

  async projection(orgId: string, query: ProjectionQueryDto): Promise<ProjectionResultDto> {
    const now = new Date().getUTCFullYear();
    const includeDetails = query.includeDetails ?? false;
    const applyInflation = query.applyInflation ?? false;
    const applyDiscount = query.applyDiscount ?? false;

    // Load scenario if specified, or use default
    let scenario: ProjectionScenarioDto | null = null;
    let inflationRate = 0;
    let discountRate = 0;
    let planningHorizonYears = 20;

    if (query.scenarioId) {
      const scenarioData = await this.scenariosService.findById(orgId, query.scenarioId);
      if (scenarioData) {
        scenario = {
          id: scenarioData.id,
          name: scenarioData.name,
          inflationRate: Number(scenarioData.inflationRate),
          discountRate: Number(scenarioData.discountRate),
          planningHorizonYears: scenarioData.planningHorizonYears,
        };
        inflationRate = scenario.inflationRate;
        discountRate = scenario.discountRate;
        planningHorizonYears = scenario.planningHorizonYears;
      }
    } else {
      // Try to get default scenario
      const defaultScenario = await this.scenariosService.findDefault(orgId);
      if (defaultScenario) {
        scenario = {
          id: defaultScenario.id,
          name: defaultScenario.name,
          inflationRate: Number(defaultScenario.inflationRate),
          discountRate: Number(defaultScenario.discountRate),
          planningHorizonYears: defaultScenario.planningHorizonYears,
        };
        inflationRate = scenario.inflationRate;
        discountRate = scenario.discountRate;
        planningHorizonYears = scenario.planningHorizonYears;
      }
    }

    const fromYear = query.fromYear ? Number(query.fromYear) : now;
    const toYear = query.toYear ? Number(query.toYear) : now + planningHorizonYears - 1;

    if (!Number.isInteger(fromYear) || !Number.isInteger(toYear)) {
      throw new BadRequestException('fromYear and toYear must be integers');
    }
    if (toYear < fromYear) {
      throw new BadRequestException('toYear must be >= fromYear');
    }
    if (toYear - fromYear + 1 > 50) {
      throw new BadRequestException('Year range must be 50 years or less');
    }

    const assets: AssetWithRelations[] = await this.prisma.asset.findMany({
      where: {
        orgId,
        ...(query.siteId ? { siteId: query.siteId } : {}),
      },
      include: {
        assetType: true,
        maintenanceItems: true,
      },
    });

    this.logger.debug(`Projection: fetched ${assets.length} assets for orgId=${orgId}`);

    // Pre-compute asset replacement info for logging and CAPEX calculation
    const assetReplacementInfo = assets.map((asset) => {
      const installedYear = asset.installedOn?.getUTCFullYear() ?? null;
      const effectiveLifeYears = asset.lifeYears ?? asset.assetType?.defaultLifeYears ?? null;
      const replacementYear =
        installedYear !== null && effectiveLifeYears !== null
          ? installedYear + effectiveLifeYears
          : null;
      const replacementCost = asset.replacementCostEur ? Number(asset.replacementCostEur) : null;
      const inRange = replacementYear !== null && replacementYear >= fromYear && replacementYear <= toYear;

      this.logger.debug(
        `Asset "${asset.name}" [${asset.id}]: installedYear=${installedYear}, ` +
        `effectiveLifeYears=${effectiveLifeYears}, replacementYear=${replacementYear}, ` +
        `replacementCostEur=${replacementCost}, inRange=${inRange}, ` +
        `maintenanceItems=${asset.maintenanceItems.length}`,
      );

      return { asset, replacementYear, replacementCost, inRange };
    });

    const rows: ProjectionRowDto[] = [];
    let totalNominal = 0;
    let totalInflated = 0;
    let npv = 0;

    for (let year = fromYear; year <= toYear; year++) {
      let opex = 0;
      let capex = 0;
      const items: ProjectionItemDto[] = [];
      const yearsFromNow = year - now;

      for (const { asset, replacementYear, replacementCost } of assetReplacementInfo) {
        // Add asset's own replacement cost in the expected replacement year
        if (replacementYear === year && replacementCost !== null) {
          capex += replacementCost;
          this.logger.debug(`Year ${year}: Asset "${asset.name}" adds CAPEX ${replacementCost} (asset replacement)`);

          if (includeDetails) {
            const item: ProjectionItemDto = {
              assetId: asset.id,
              assetName: asset.name,
              maintenanceItemId: null,
              kind: 'REPLACEMENT',
              cost: replacementCost,
              source: `Asset replacement (life: ${asset.lifeYears ?? asset.assetType?.defaultLifeYears ?? '?'} years)`,
            };
            if (applyInflation && inflationRate > 0) {
              item.inflatedCost = replacementCost * Math.pow(1 + inflationRate, yearsFromNow);
            }
            items.push(item);
          }
        }

        // Process maintenance items
        for (const mItem of asset.maintenanceItems) {
          const cost = Number(mItem.costEur);

          if (mItem.kind === MaintenanceKind.MAINTENANCE) {
            const start = mItem.startsAtYear ?? fromYear;
            const end = mItem.endsAtYear ?? toYear;
            if (year < start || year > end) continue;
            if ((year - start) % mItem.intervalYears === 0) {
              opex += cost;

              if (includeDetails) {
                const item: ProjectionItemDto = {
                  assetId: asset.id,
                  assetName: asset.name,
                  maintenanceItemId: mItem.id,
                  kind: 'MAINTENANCE',
                  cost,
                  source: `Every ${mItem.intervalYears} year${mItem.intervalYears > 1 ? 's' : ''}${mItem.notes ? ` (${mItem.notes})` : ''}`,
                };
                if (applyInflation && inflationRate > 0) {
                  item.inflatedCost = cost * Math.pow(1 + inflationRate, yearsFromNow);
                }
                items.push(item);
              }
            }
          }

          if (mItem.kind === MaintenanceKind.REPLACEMENT) {
            // MaintenanceItem REPLACEMENT overrides or supplements asset replacement
            const itemReplacementYear = mItem.startsAtYear ?? replacementYear;
            if (itemReplacementYear === null) continue;
            if (mItem.endsAtYear && itemReplacementYear > mItem.endsAtYear) continue;
            if (itemReplacementYear === year) {
              capex += cost;
              this.logger.debug(`Year ${year}: Asset "${asset.name}" adds CAPEX ${cost} (maintenance item)`);

              if (includeDetails) {
                const item: ProjectionItemDto = {
                  assetId: asset.id,
                  assetName: asset.name,
                  maintenanceItemId: mItem.id,
                  kind: 'REPLACEMENT',
                  cost,
                  source: `Scheduled replacement${mItem.notes ? ` (${mItem.notes})` : ''}`,
                };
                if (applyInflation && inflationRate > 0) {
                  item.inflatedCost = cost * Math.pow(1 + inflationRate, yearsFromNow);
                }
                items.push(item);
              }
            }
          }
        }
      }

      const total = opex + capex;
      totalNominal += total;

      const row: ProjectionRowDto = {
        year,
        opex,
        capex,
        total,
      };

      // Apply inflation adjustment
      if (applyInflation && inflationRate > 0) {
        const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow);
        row.inflatedOpex = opex * inflationFactor;
        row.inflatedCapex = capex * inflationFactor;
        row.inflatedTotal = total * inflationFactor;
        totalInflated += row.inflatedTotal;
      }

      // Apply discount for present value calculation
      if (applyDiscount && discountRate > 0) {
        const discountFactor = Math.pow(1 + discountRate, -yearsFromNow);
        // Use inflated values if available, otherwise nominal
        const valueToDiscount = applyInflation && row.inflatedTotal ? row.inflatedTotal : total;
        row.presentValue = valueToDiscount * discountFactor;
        npv += row.presentValue;
      }

      if (includeDetails) {
        // Sort items: CAPEX first (REPLACEMENT), then OPEX (MAINTENANCE), then by cost descending
        row.items = items.sort((a, b) => {
          if (a.kind !== b.kind) {
            return a.kind === 'REPLACEMENT' ? -1 : 1;
          }
          return b.cost - a.cost;
        });
      }

      rows.push(row);
    }

    const result: ProjectionResultDto = {
      fromYear,
      toYear,
      siteId: query.siteId ?? null,
      scenario,
      totalNominal,
      rows,
    };

    if (applyInflation) {
      result.totalInflated = totalInflated;
    }

    if (applyDiscount) {
      result.npv = npv;
    }

    return result;
  }
}