import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AssetsRepository } from './assets.repository';
import { AssetsQueryDto } from './dto/assets-query.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { Prisma } from '@prisma/client';

/**
 * Asset service implementing the Asset Identity Contract.
 * See: docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md
 */
@Injectable()
export class AssetsService {
  constructor(private readonly repo: AssetsRepository) {}

  list(orgId: string, query: AssetsQueryDto) {
    const filters = {
      siteId: query.siteId,
      assetTypeId: query.assetTypeId,
      status: query.status,
      q: query.q,
      needsDetails: query.needsDetails,
    };
    return this.repo.findAll(orgId, filters).then((assets) => assets.map(this.withDerivedFields));
  }

  async getMissingDetailsCount(orgId: string): Promise<{ count: number }> {
    const assets = await this.repo.findAll(orgId, { needsDetails: true });
    return { count: assets.length };
  }

  async getById(orgId: string, id: string) {
    const asset = await this.repo.findById(orgId, id);
    if (!asset) throw new NotFoundException('Asset not found');
    return this.withDerivedFields(asset);
  }

  /**
   * Find asset by externalRef (business identity) within an organization.
   * Per Asset Identity Contract, all lookups should use externalRef, not database id.
   */
  async getByExternalRef(orgId: string, externalRef: string) {
    const asset = await this.repo.findByExternalRef(orgId, externalRef);
    if (!asset) throw new NotFoundException(`Asset with externalRef "${externalRef}" not found`);
    return this.withDerivedFields(asset);
  }

  /**
   * Create a new asset.
   * Per Asset Identity Contract:
   * - externalRef is REQUIRED and becomes the immutable business identity
   * - externalRef must be unique within the organization
   */
  create(orgId: string, dto: CreateAssetDto) {
    if (!dto.externalRef || dto.externalRef.trim() === '') {
      throw new BadRequestException('externalRef is required per Asset Identity Contract');
    }

    const data = {
      ...dto,
      derivedIdentity: dto.derivedIdentity ?? false,
      installedOn: dto.installedOn ? new Date(dto.installedOn) : undefined,
      replacementCostEur:
        dto.replacementCostEur === undefined || dto.replacementCostEur === null
          ? undefined
          : new Prisma.Decimal(dto.replacementCostEur),
    };
    return this.repo.create(orgId, data).then(this.withDerivedFields);
  }

  /**
   * Update an existing asset.
   * Per Asset Identity Contract:
   * - externalRef is IMMUTABLE and cannot be changed
   * - derivedIdentity cannot be changed via normal update
   */
  update(orgId: string, id: string, dto: UpdateAssetDto) {
    // Explicitly exclude any identity fields that might have been passed
    // These are enforced at DTO level but we double-check here
    const { ...updateData } = dto as Record<string, unknown>;
    delete updateData.externalRef; // IMMUTABLE per Identity Contract
    delete updateData.derivedIdentity; // Cannot change via update

    const data = {
      ...updateData,
      installedOn: dto.installedOn ? new Date(dto.installedOn) : undefined,
      replacementCostEur:
        dto.replacementCostEur === undefined || dto.replacementCostEur === null
          ? undefined
          : new Prisma.Decimal(dto.replacementCostEur),
    };
    return this.repo.update(orgId, id, data).then(this.withDerivedFields);
  }

  /**
   * Replace a derived identity with a real external reference.
   * This is the ONLY way to change an externalRef after creation,
   * and only works for assets with derivedIdentity=true.
   */
  async replaceExternalRef(orgId: string, id: string, newExternalRef: string) {
    const asset = await this.repo.findById(orgId, id);
    if (!asset) throw new NotFoundException('Asset not found');
    
    if (!asset.derivedIdentity) {
      throw new BadRequestException(
        'Cannot change externalRef: asset does not have a derived identity. ' +
        'Per Asset Identity Contract, externalRef is immutable once set to a real value.'
      );
    }

    if (!newExternalRef || newExternalRef.trim() === '') {
      throw new BadRequestException('newExternalRef is required');
    }

    // Update the externalRef and mark as no longer derived
    return this.repo.update(orgId, id, {
      externalRef: newExternalRef.trim(),
      derivedIdentity: false,
    }).then(this.withDerivedFields);
  }

  private withDerivedFields(asset: any) {
    const effectiveLifeYears = asset.lifeYears ?? asset.assetType?.defaultLifeYears ?? null;
    const expectedReplacementYear =
      asset.installedOn && effectiveLifeYears !== null
        ? asset.installedOn.getUTCFullYear() + effectiveLifeYears
        : null;
    // ageYears: computed at API boundary (not stored in DB)
    const installedOn = asset.installedOn;
    const ageYears =
      installedOn && typeof installedOn.getUTCFullYear === 'function'
        ? new Date().getUTCFullYear() - installedOn.getUTCFullYear()
        : null;

    return {
      ...asset,
      effectiveLifeYears,
      expectedReplacementYear,
      ageYears,
    };
  }
}