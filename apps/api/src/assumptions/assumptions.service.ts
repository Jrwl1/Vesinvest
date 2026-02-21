import { Injectable } from '@nestjs/common';
import { AssumptionsRepository } from './assumptions.repository';
import { UpsertAssumptionDto } from './dto/upsert-assumption.dto';

@Injectable()
export class AssumptionsService {
  constructor(private readonly repo: AssumptionsRepository) {}

  async list(orgId: string) {
    const current = await this.repo.findAll(orgId);
    if (current.length > 0) return current;
    return this.repo.resetDefaults(orgId);
  }

  upsert(orgId: string, avain: string, dto: UpsertAssumptionDto) {
    return this.repo.upsert(orgId, avain, dto);
  }

  resetDefaults(orgId: string) {
    return this.repo.resetDefaults(orgId);
  }
}
