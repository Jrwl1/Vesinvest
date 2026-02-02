import { Body, Controller, Get, Patch, Post, Req, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('sites')
export class SitesController {
  constructor(private readonly service: SitesService) {}

  @Get()
  list(@Req() req: Request) {
    return this.service.list(req.orgId!);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateSiteDto) {
    return this.service.create(req.orgId!, dto);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.service.update(req.orgId!, id, dto);
  }
}