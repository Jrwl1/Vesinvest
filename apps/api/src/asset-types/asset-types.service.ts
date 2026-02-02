import { Injectable } from '@nestjs/common';
import { AssetTypesRepository } from './asset-types.repository';
import { CreateAssetTypeDto } from './dto/create-asset-type.dto';
import { UpdateAssetTypeDto } from './dto/update-asset-type.dto';

@Injectable()
export class AssetTypesService {
  constructor(private readonly repo: AssetTypesRepository) {}

  list(orgId: string) {
    return this.repo.findAll(orgId);
  }

  create(orgId: string, dto: CreateAssetTypeDto) {
    return this.repo.create(orgId, dto);
  }

  update(orgId: string, id: string, dto: UpdateAssetTypeDto) {
    return this.repo.update(orgId, id, dto);
  }
}