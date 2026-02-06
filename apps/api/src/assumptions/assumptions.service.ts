import { Injectable } from '@nestjs/common';
import { AssumptionsRepository } from './assumptions.repository';
import { UpsertAssumptionDto } from './dto/upsert-assumption.dto';

@Injectable()
export class AssumptionsService {
  constructor(private readonly repo: AssumptionsRepository) {}

  list(orgId: string) {
    return this.repo.findAll(orgId);
  }

  upsert(orgId: string, avain: string, dto: UpsertAssumptionDto) {
    return this.repo.upsert(orgId, avain, dto);
  }

  resetDefaults(orgId: string) {
    return this.repo.resetDefaults(orgId);
  }
}
