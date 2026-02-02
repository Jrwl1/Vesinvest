import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MaintenanceRepository } from './maintenance.repository';
import { CreateMaintenanceItemDto } from './dto/create-maintenance-item.dto';
import { UpdateMaintenanceItemDto } from './dto/update-maintenance-item.dto';
import { ProjectionQueryDto } from './dto/projection-query.dto';
import {
  ProjectionItemDto,
  ProjectionRowDto,
  ProjectionResultDto,
} from './dto/projection-result.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceKind, Prisma } from '@prisma/client';

type AssetWithRelations = Prisma.AssetGetPayload<{
  include: { assetType: true; maintenanceItems: true };
}>;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly repo: MaintenanceRepository,
    private readonly prisma: PrismaService,
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
    const fromYear = query.fromYear ? Number(query.fromYear) : now;
    const toYear = query.toYear ? Number(query.toYear) : now + 19;
    const includeDetails = query.includeDetails ?? false;

    if (!Number.isInteger(fromYear) || !Number.isInteger(toYear)) {
      throw new BadRequestException('fromYear and toYear must be integers');
    }
    if (toYear < fromYear) {
      throw new BadRequestException('toYear must be >= fromYear');
    }
    if (toYear - fromYear + 1 > 30) {
      throw new BadRequestException('Year range must be 30 years or less');
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
    for (let year = fromYear; year <= toYear; year++) {
      let opex = 0;
      let capex = 0;
      const items: ProjectionItemDto[] = [];

      for (const { asset, replacementYear, replacementCost } of assetReplacementInfo) {
        // Add asset's own replacement cost in the expected replacement year
        if (replacementYear === year && replacementCost !== null) {
          capex += replacementCost;
          this.logger.debug(`Year ${year}: Asset "${asset.name}" adds CAPEX ${replacementCost} (asset replacement)`);

          if (includeDetails) {
            items.push({
              assetId: asset.id,
              assetName: asset.name,
              maintenanceItemId: null,
              kind: 'REPLACEMENT',
              cost: replacementCost,
              source: `Asset replacement (life: ${asset.lifeYears ?? asset.assetType?.defaultLifeYears ?? '?'} years)`,
            });
          }
        }

        // Process maintenance items
        for (const item of asset.maintenanceItems) {
          const cost = Number(item.costEur);

          if (item.kind === MaintenanceKind.MAINTENANCE) {
            const start = item.startsAtYear ?? fromYear;
            const end = item.endsAtYear ?? toYear;
            if (year < start || year > end) continue;
            if ((year - start) % item.intervalYears === 0) {
              opex += cost;

              if (includeDetails) {
                items.push({
                  assetId: asset.id,
                  assetName: asset.name,
                  maintenanceItemId: item.id,
                  kind: 'MAINTENANCE',
                  cost,
                  source: `Every ${item.intervalYears} year${item.intervalYears > 1 ? 's' : ''}${item.notes ? ` (${item.notes})` : ''}`,
                });
              }
            }
          }

          if (item.kind === MaintenanceKind.REPLACEMENT) {
            // MaintenanceItem REPLACEMENT overrides or supplements asset replacement
            const itemReplacementYear = item.startsAtYear ?? replacementYear;
            if (itemReplacementYear === null) continue;
            if (item.endsAtYear && itemReplacementYear > item.endsAtYear) continue;
            if (itemReplacementYear === year) {
              capex += cost;
              this.logger.debug(`Year ${year}: Asset "${asset.name}" adds CAPEX ${cost} (maintenance item)`);

              if (includeDetails) {
                items.push({
                  assetId: asset.id,
                  assetName: asset.name,
                  maintenanceItemId: item.id,
                  kind: 'REPLACEMENT',
                  cost,
                  source: `Scheduled replacement${item.notes ? ` (${item.notes})` : ''}`,
                });
              }
            }
          }
        }
      }

      const row: ProjectionRowDto = {
        year,
        opex,
        capex,
        total: opex + capex,
      };

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

    return {
      fromYear,
      toYear,
      siteId: query.siteId ?? null,
      rows,
    };
  }
}