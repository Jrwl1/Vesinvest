import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { AssumptionsService } from './assumptions.service';
import { UpsertAssumptionDto } from './dto/upsert-assumption.dto';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('assumptions')
export class AssumptionsController {
  constructor(private readonly service: AssumptionsService) {}

  @Get()
  list(@Req() req: Request) {
    return this.service.list(req.orgId!);
  }

  @Put(':avain')
  upsert(@Req() req: Request, @Param('avain') avain: string, @Body() dto: UpsertAssumptionDto) {
    return this.service.upsert(req.orgId!, avain, dto);
  }

  @Post('reset-defaults')
  resetDefaults(@Req() req: Request) {
    return this.service.resetDefaults(req.orgId!);
  }
}
