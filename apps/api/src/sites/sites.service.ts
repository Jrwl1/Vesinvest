import { Injectable } from '@nestjs/common';
import { SitesRepository } from './sites.repository';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(private readonly repo: SitesRepository) {}

  list(orgId: string) {
    return this.repo.findAll(orgId);
  }

  create(orgId: string, dto: CreateSiteDto) {
    return this.repo.create(orgId, dto);
  }

  update(orgId: string, id: string, dto: UpdateSiteDto) {
    return this.repo.update(orgId, id, dto);
  }
}