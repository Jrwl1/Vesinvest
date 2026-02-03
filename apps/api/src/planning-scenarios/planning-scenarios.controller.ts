import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { PlanningScenariosService } from './planning-scenarios.service';
import { CreatePlanningScenarioDto } from './dto/create-planning-scenario.dto';
import { UpdatePlanningScenarioDto } from './dto/update-planning-scenario.dto';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('planning-scenarios')
export class PlanningScenariosController {
  constructor(private readonly service: PlanningScenariosService) {}

  @Get()
  list(@Req() req: Request) {
    return this.service.list(req.orgId!);
  }

  @Get('default')
  getDefault(@Req() req: Request) {
    return this.service.findDefault(req.orgId!);
  }

  @Get(':id')
  findById(@Req() req: Request, @Param('id') id: string) {
    return this.service.findById(req.orgId!, id);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreatePlanningScenarioDto) {
    return this.service.create(req.orgId!, dto);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdatePlanningScenarioDto) {
    return this.service.update(req.orgId!, id, dto);
  }

  @Delete(':id')
  delete(@Req() req: Request, @Param('id') id: string) {
    return this.service.delete(req.orgId!, id);
  }
}
