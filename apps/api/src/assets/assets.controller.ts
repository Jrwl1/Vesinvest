import { Body, Controller, Get, Patch, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { AssetsService } from './assets.service';
import { AssetsQueryDto } from './dto/assets-query.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import type { Request } from 'express';

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

  @Get(':id')
  getById(@Req() req: Request, @Param('id') id: string) {
    return this.service.getById(req.orgId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.service.update(req.orgId!, id, dto);
  }
}