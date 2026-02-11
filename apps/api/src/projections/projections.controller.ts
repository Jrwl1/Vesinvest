import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { ProjectionsService } from './projections.service';
import { CreateProjectionDto } from './dto/create-projection.dto';
import { UpdateProjectionDto } from './dto/update-projection.dto';
import type { Request, Response } from 'express';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('projections')
export class ProjectionsController {
  constructor(private readonly service: ProjectionsService) {}

  // ── Ennuste (Projection) ──

  @Get()
  list(@Req() req: Request) {
    return this.service.list(req.orgId!);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateProjectionDto) {
    return this.service.create(req.orgId!, dto);
  }

  @Get(':id')
  findById(@Req() req: Request, @Param('id') id: string) {
    return this.service.findById(req.orgId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateProjectionDto) {
    return this.service.update(req.orgId!, id, dto);
  }

  @Delete(':id')
  delete(@Req() req: Request, @Param('id') id: string) {
    return this.service.delete(req.orgId!, id);
  }

  // ── Computation ──

  /**
   * Upsert + compute: find-or-create a projection for a budget, then compute.
   * Resilient to stale IDs — always resolves by budget, not projection ID.
   */
  @Post('compute-for-budget')
  computeForBudget(
    @Req() req: Request,
    @Body() body: { talousarvioId: string; olettamusYlikirjoitukset?: Record<string, number> },
  ) {
    return this.service.computeForBudget(req.orgId!, body.talousarvioId, body.olettamusYlikirjoitukset);
  }

  @Post(':id/compute')
  compute(@Req() req: Request, @Param('id') id: string) {
    return this.service.compute(req.orgId!, id);
  }

  // ── CSV Export ──

  @Get(':id/export')
  async exportCsv(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(req.orgId!, id);
    const projection = await this.service.findById(req.orgId!, id);

    const filename = `ennuste_${projection.nimi.replace(/[^a-zA-Z0-9äöåÄÖÅ_-]/g, '_')}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM for proper Finnish character display in Excel
    res.send('\uFEFF' + csv);
  }

  /** V1 PDF cashflow export. Returns application/pdf (diagram + compact table per ADR). */
  @Get(':id/export-pdf')
  async exportPdf(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportPdf(req.orgId!, id);
    const projection = await this.service.findById(req.orgId!, id);
    const filename = `ennuste_${projection.nimi.replace(/[^a-zA-Z0-9äöåÄÖÅ_-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }
}
