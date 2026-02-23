import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { V2Service } from './v2.service';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('v2')
export class V2Controller {
  constructor(private readonly service: V2Service) {}

  @Get('overview')
  async overview(@Req() req: Request) {
    return this.service.getOverview(req.orgId!);
  }

  @Post('overview/peer-refresh')
  async refreshPeer(@Req() req: Request, @Body() body: { vuosi?: number }) {
    return this.service.refreshPeerSnapshot(req.orgId!, body?.vuosi);
  }

  @Get('import/search')
  async importSearch(@Query('q') q: string, @Query('limit') limit?: string) {
    const parsedLimit = Number.parseInt(limit ?? '20', 10);
    return this.service.searchOrganizations(
      q ?? '',
      Number.isFinite(parsedLimit) ? parsedLimit : 20,
    );
  }

  @Post('import/connect')
  async importConnect(@Req() req: Request, @Body() body: { veetiId: number }) {
    return this.service.connectOrganization(req.orgId!, body.veetiId);
  }

  @Post('import/sync')
  async importSync(@Req() req: Request, @Body() body: { years?: number[] }) {
    return this.service.syncImport(req.orgId!, body?.years ?? []);
  }

  @Get('import/status')
  async importStatus(@Req() req: Request) {
    return this.service.getImportStatus(req.orgId!);
  }

  @Get('forecast/scenarios')
  async listScenarios(@Req() req: Request) {
    return this.service.listForecastScenarios(req.orgId!);
  }

  @Post('forecast/scenarios')
  async createScenario(
    @Req() req: Request,
    @Body()
    body: {
      name?: string;
      talousarvioId?: string;
      horizonYears?: number;
      copyFromScenarioId?: string;
      compute?: boolean;
    },
  ) {
    return this.service.createForecastScenario(req.orgId!, body);
  }

  @Get('forecast/scenarios/:id')
  async getScenario(@Req() req: Request, @Param('id') id: string) {
    return this.service.getForecastScenario(req.orgId!, id);
  }

  @Patch('forecast/scenarios/:id')
  async patchScenario(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      horizonYears?: number;
      yearlyInvestments?: Array<{ year: number; amount: number }>;
    },
  ) {
    return this.service.updateForecastScenario(req.orgId!, id, body);
  }

  @Delete('forecast/scenarios/:id')
  async deleteScenario(@Req() req: Request, @Param('id') id: string) {
    return this.service.deleteForecastScenario(req.orgId!, id);
  }

  @Post('forecast/scenarios/:id/compute')
  async computeScenario(@Req() req: Request, @Param('id') id: string) {
    return this.service.computeForecastScenario(req.orgId!, id);
  }

  @Get('reports')
  async listReports(
    @Req() req: Request,
    @Query('ennusteId') ennusteId?: string,
  ) {
    return this.service.listReports(req.orgId!, ennusteId);
  }

  @Post('reports')
  async createReport(@Req() req: Request, @Body() body: CreateReportDto) {
    const user = req.user as { sub?: string };
    return this.service.createReport(req.orgId!, user?.sub ?? '', body);
  }

  @Get('reports/:id')
  async getReport(@Req() req: Request, @Param('id') id: string) {
    return this.service.getReport(req.orgId!, id);
  }

  @Get('reports/:id/pdf')
  @Header('Content-Type', 'application/pdf')
  async getReportPdf(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.buildReportPdf(req.orgId!, id);
    const report = await this.service.getReport(req.orgId!, id);
    const safeTitle = report.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}.pdf"`,
    );
    res.send(pdf);
  }
}
