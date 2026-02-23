import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { VeetiBudgetGenerator } from './veeti-budget-generator';
import { VeetiBenchmarkService } from './veeti-benchmark.service';
import { VeetiSyncService } from './veeti-sync.service';
import { VeetiService } from './veeti.service';
import { VeetiConnectDto } from './dto/veeti-connect.dto';
import { VeetiSearchDto } from './dto/veeti-search.dto';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('veeti')
export class VeetiController {
  constructor(
    private readonly veetiService: VeetiService,
    private readonly syncService: VeetiSyncService,
    private readonly budgetGenerator: VeetiBudgetGenerator,
  ) {}

  @Get('search')
  async search(@Query() query: VeetiSearchDto) {
    return this.veetiService.searchOrganizations(query.q ?? '', query.limit ?? 20);
  }

  @Post('connect')
  async connect(@Req() req: Request, @Body() body: VeetiConnectDto) {
    return this.syncService.connectOrg(req.orgId!, body.veetiId);
  }

  @Get('status')
  async status(@Req() req: Request) {
    const link = await this.syncService.getStatus(req.orgId!);
    return {
      connected: Boolean(link),
      ...(link ?? {}),
    };
  }

  @Post('refresh')
  async refresh(@Req() req: Request) {
    return this.syncService.refreshOrg(req.orgId!);
  }

  @Get('years')
  async years(@Req() req: Request) {
    return this.syncService.getAvailableYears(req.orgId!);
  }

  @Get('tilinpaatos/:vuosi')
  async tilinpaatos(@Req() req: Request, @Param('vuosi', ParseIntPipe) vuosi: number) {
    return this.syncService.getSnapshots(req.orgId!, 'tilinpaatos', vuosi);
  }

  @Get('investoinnit')
  async investoinnit(@Req() req: Request) {
    return this.syncService.getSnapshots(req.orgId!, 'investointi');
  }

  @Get('drivers/:vuosi')
  async drivers(@Req() req: Request, @Param('vuosi', ParseIntPipe) vuosi: number) {
    const [taksa, vesi, jatevesi] = await Promise.all([
      this.syncService.getSnapshots(req.orgId!, 'taksa', vuosi),
      this.syncService.getSnapshots(req.orgId!, 'volume_vesi', vuosi),
      this.syncService.getSnapshots(req.orgId!, 'volume_jatevesi', vuosi),
    ]);

    return {
      vuosi,
      taksa,
      volumeVesi: vesi,
      volumeJatevesi: jatevesi,
    };
  }

  @Post('generate-budgets')
  async generateBudgets(
    @Req() req: Request,
    @Body() body: { years?: number[] },
  ) {
    const years = Array.isArray(body?.years)
      ? body.years.map((year) => Number(year)).filter((year) => Number.isInteger(year))
      : [];

    if (years.length === 0) {
      throw new BadRequestException('Provide at least one valid year.');
    }

    return this.budgetGenerator.generateBudgets(req.orgId!, years);
  }

  @Get('preview-budget/:vuosi')
  async previewBudget(@Req() req: Request, @Param('vuosi', ParseIntPipe) vuosi: number) {
    return this.budgetGenerator.previewBudget(req.orgId!, vuosi);
  }
}

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('benchmarks')
export class BenchmarkController {
  constructor(private readonly benchmarks: VeetiBenchmarkService) {}

  @Get('trends')
  async trends(@Req() req: Request, @Query('metric') metric: string) {
    if (!metric || !metric.trim()) {
      throw new BadRequestException('Query parameter metric is required.');
    }
    return this.benchmarks.getMetricTrend(req.orgId!, metric.trim());
  }

  @Get('peer-group')
  async peerGroup(@Req() req: Request) {
    return this.benchmarks.getPeerGroup(req.orgId!);
  }

  @Get(':vuosi')
  async byYear(@Req() req: Request, @Param('vuosi', ParseIntPipe) vuosi: number) {
    return this.benchmarks.getBenchmarksForYear(req.orgId!, vuosi);
  }

  @Post('recompute/:vuosi')
  async recompute(@Param('vuosi', ParseIntPipe) vuosi: number) {
    return this.benchmarks.recomputeYear(vuosi);
  }
}

