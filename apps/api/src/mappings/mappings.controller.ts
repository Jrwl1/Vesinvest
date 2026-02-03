import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { MappingsService } from './mappings.service';
import { CreateMappingDto } from './dto/create-mapping.dto';
import { UpdateMappingDto } from './dto/update-mapping.dto';
import type { Request } from 'express';
import { TargetEntity } from '@prisma/client';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('mappings')
export class MappingsController {
  constructor(private readonly service: MappingsService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('targetEntity') targetEntity?: TargetEntity,
    @Query('isTemplate') isTemplate?: string,
  ) {
    return this.service.list(req.orgId!, {
      targetEntity,
      isTemplate: isTemplate === 'true' ? true : isTemplate === 'false' ? false : undefined,
    });
  }

  @Get('canonical-fields')
  getCanonicalFields(@Query('targetEntity') targetEntity?: TargetEntity) {
    return this.service.getCanonicalFields(targetEntity);
  }

  @Get(':id')
  findById(@Req() req: Request, @Param('id') id: string) {
    return this.service.findById(req.orgId!, id);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateMappingDto) {
    return this.service.create(req.orgId!, dto);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateMappingDto) {
    return this.service.update(req.orgId!, id, dto);
  }

  @Delete(':id')
  delete(@Req() req: Request, @Param('id') id: string) {
    return this.service.delete(req.orgId!, id);
  }

  @Post(':id/validate')
  validateMapping(
    @Req() req: Request,
    @Param('id') mappingId: string,
    @Body() body: { importId: string; sheetId: string },
  ) {
    return this.service.validateMapping(req.orgId!, mappingId, body.importId, body.sheetId);
  }

  @Get('templates/match')
  findMatchingTemplates(
    @Req() req: Request,
    @Query('importId') importId: string,
    @Query('sheetId') sheetId: string,
    @Query('targetEntity') targetEntity: TargetEntity,
  ) {
    return this.service.findMatchingTemplates(req.orgId!, importId, sheetId, targetEntity);
  }

  @Get('templates/list')
  getTemplates(@Req() req: Request, @Query('targetEntity') targetEntity?: TargetEntity) {
    return this.service.getTemplates(req.orgId!, targetEntity);
  }
}
