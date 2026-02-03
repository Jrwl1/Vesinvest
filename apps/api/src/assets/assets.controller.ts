import { Body, Controller, Get, Patch, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { AssetsService } from './assets.service';
import { AssetsQueryDto } from './dto/assets-query.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import type { Request } from 'express';

/**
 * Asset controller implementing Asset Identity Contract.
 * See: docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md
 */
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  list(@Req() req: Request, @Query() query: AssetsQueryDto) {
    return this.service.list(req.orgId!, query);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateAssetDto) {
    return this.service.create(req.orgId!, dto);
  }

  /**
   * Get asset by database ID.
   * Note: Per Asset Identity Contract, prefer using /assets/by-ref/:externalRef
   * for business logic lookups.
   */
  @Get(':id')
  getById(@Req() req: Request, @Param('id') id: string) {
    return this.service.getById(req.orgId!, id);
  }

  /**
   * Get asset by externalRef (business identity).
   * Per Asset Identity Contract, this is the preferred lookup method.
   */
  @Get('by-ref/:externalRef')
  getByExternalRef(@Req() req: Request, @Param('externalRef') externalRef: string) {
    return this.service.getByExternalRef(req.orgId!, externalRef);
  }

  /**
   * Update an asset.
   * Per Asset Identity Contract, externalRef cannot be changed via this endpoint.
   */
  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.service.update(req.orgId!, id, dto);
  }

  /**
   * Replace a derived (fallback) identity with a real external reference.
   * This is the ONLY way to change an externalRef, and only works for
   * assets with derivedIdentity=true.
   * 
   * Per Asset Identity Contract:
   * - Fallbacks must be replaceable with a real internal ID
   * - Real identities are immutable
   */
  @Patch(':id/replace-identity')
  replaceExternalRef(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('externalRef') externalRef: string,
  ) {
    return this.service.replaceExternalRef(req.orgId!, id, externalRef);
  }
}