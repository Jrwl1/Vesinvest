import { Body, Controller, Get, Patch, Post, Req, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { AssetTypesService } from './asset-types.service';
import { CreateAssetTypeDto } from './dto/create-asset-type.dto';
import { UpdateAssetTypeDto } from './dto/update-asset-type.dto';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('asset-types')
export class AssetTypesController {
  constructor(private readonly service: AssetTypesService) {}

  @Get()
  list(@Req() req: Request) {
    return this.service.list(req.orgId!);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateAssetTypeDto) {
    return this.service.create(req.orgId!, dto);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAssetTypeDto) {
    return this.service.update(req.orgId!, id, dto);
  }
}