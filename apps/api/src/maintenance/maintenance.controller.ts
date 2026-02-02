import { Body, Controller, Get, Patch, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceItemDto } from './dto/create-maintenance-item.dto';
import { UpdateMaintenanceItemDto } from './dto/update-maintenance-item.dto';
import { ProjectionQueryDto } from './dto/projection-query.dto';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller()
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Post('maintenance-items')
  create(@Req() req: Request, @Body() dto: CreateMaintenanceItemDto) {
    return this.service.create(req.orgId!, dto);
  }

  @Get('maintenance-items')
  list(@Req() req: Request, @Query() query: { assetId?: string; siteId?: string }) {
    return this.service.list(req.orgId!, query);
  }

  @Patch('maintenance-items/:id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateMaintenanceItemDto) {
    return this.service.update(req.orgId!, id, dto);
  }

  @Get('plans/projection')
  projection(@Req() req: Request, @Query() query: ProjectionQueryDto) {
    return this.service.projection(req.orgId!, query);
  }
}