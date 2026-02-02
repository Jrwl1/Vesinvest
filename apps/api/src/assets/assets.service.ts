import { Injectable, NotFoundException } from '@nestjs/common';
import { AssetsRepository } from './assets.repository';
import { AssetsQueryDto } from './dto/assets-query.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AssetsService {
  constructor(private readonly repo: AssetsRepository) {}

  list(orgId: string, query: AssetsQueryDto) {
    return this.repo.findAll(orgId, query).then((assets) => assets.map(this.withDerivedFields));
  }

  async getById(orgId: string, id: string) {
    const asset = await this.repo.findById(orgId, id);
    if (!asset) throw new NotFoundException('Asset not found');
    return this.withDerivedFields(asset);
  }

  create(orgId: string, dto: CreateAssetDto) {
    const data = {
      ...dto,
      installedOn: dto.installedOn ? new Date(dto.installedOn) : undefined,
      replacementCostEur:
        dto.replacementCostEur === undefined || dto.replacementCostEur === null
          ? undefined
          : new Prisma.Decimal(dto.replacementCostEur),
    };
    return this.repo.create(orgId, data).then(this.withDerivedFields);
  }

  update(orgId: string, id: string, dto: UpdateAssetDto) {
    const data = {
      ...dto,
      installedOn: dto.installedOn ? new Date(dto.installedOn) : undefined,
      replacementCostEur:
        dto.replacementCostEur === undefined || dto.replacementCostEur === null
          ? undefined
          : new Prisma.Decimal(dto.replacementCostEur),
    };
    return this.repo.update(orgId, id, data).then(this.withDerivedFields);
  }

  private withDerivedFields(asset: any) {
    const effectiveLifeYears = asset.lifeYears ?? asset.assetType?.defaultLifeYears ?? null;
    const expectedReplacementYear =
      asset.installedOn && effectiveLifeYears !== null
        ? asset.installedOn.getUTCFullYear() + effectiveLifeYears
        : null;

    return {
      ...asset,
      effectiveLifeYears,
      expectedReplacementYear,
    };
  }
}