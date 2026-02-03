import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../repositories/base.repository';
import { TargetEntity, FieldCriticality, Prisma } from '@prisma/client';

export interface CreateMappingColumnInput {
  sourceColumn: string;
  targetField: string;
  transformation?: Prisma.InputJsonValue;
  required?: boolean;
  criticality?: FieldCriticality;
}

export interface CreateMappingInput {
  name: string;
  targetEntity: TargetEntity;
  isTemplate?: boolean;
  columns: CreateMappingColumnInput[];
}

@Injectable()
export class MappingsRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAll(orgId: string, options?: { targetEntity?: TargetEntity; isTemplate?: boolean }) {
    const org = this.requireOrgId(orgId);
    return this.prisma.importMapping.findMany({
      where: {
        orgId: org,
        ...(options?.targetEntity ? { targetEntity: options.targetEntity } : {}),
        ...(options?.isTemplate !== undefined ? { isTemplate: options.isTemplate } : {}),
      },
      include: { columns: true },
      orderBy: [{ isTemplate: 'desc' }, { name: 'asc' }],
    });
  }

  findById(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.importMapping.findFirst({
      where: { id, orgId: org },
      include: { columns: true },
    });
  }

  findByName(orgId: string, name: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.importMapping.findFirst({
      where: { orgId: org, name },
      include: { columns: true },
      orderBy: { version: 'desc' },
    });
  }

  async create(orgId: string, data: CreateMappingInput) {
    const org = this.requireOrgId(orgId);

    // Check if a mapping with this name exists and get next version
    const existing = await this.prisma.importMapping.findFirst({
      where: { orgId: org, name: data.name },
      orderBy: { version: 'desc' },
    });
    const version = existing ? existing.version + 1 : 1;

    return this.prisma.importMapping.create({
      data: {
        orgId: org,
        name: data.name,
        targetEntity: data.targetEntity,
        version,
        isTemplate: data.isTemplate ?? false,
        columns: {
          create: data.columns.map((col) => ({
            sourceColumn: col.sourceColumn,
            targetField: col.targetField,
            transformation: col.transformation ?? Prisma.JsonNull,
            required: col.required ?? false,
            criticality: col.criticality ?? FieldCriticality.optional,
          })),
        },
      },
      include: { columns: true },
    });
  }

  async update(orgId: string, id: string, data: Partial<CreateMappingInput>) {
    const org = this.requireOrgId(orgId);

    // First verify the mapping exists and belongs to org
    const existing = await this.findById(orgId, id);
    if (!existing) throw new NotFoundException('Mapping not found');

    // If columns are being updated, delete old ones and create new
    if (data.columns) {
      await this.prisma.mappingColumn.deleteMany({
        where: { mappingId: id },
      });
    }

    return this.prisma.importMapping.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.targetEntity ? { targetEntity: data.targetEntity } : {}),
        ...(data.isTemplate !== undefined ? { isTemplate: data.isTemplate } : {}),
        ...(data.columns
          ? {
              columns: {
                create: data.columns.map((col) => ({
                  sourceColumn: col.sourceColumn,
                  targetField: col.targetField,
                  transformation: col.transformation ?? Prisma.JsonNull,
                  required: col.required ?? false,
                  criticality: col.criticality ?? FieldCriticality.optional,
                })),
              },
            }
          : {}),
      },
      include: { columns: true },
    });
  }

  async delete(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.importMapping.deleteMany({
      where: { id, orgId: org },
    });
    if (result.count === 0) throw new NotFoundException('Mapping not found');
    return { deleted: true };
  }
}
