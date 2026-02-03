import { Injectable } from '@nestjs/common';
import { PlanningScenariosRepository } from './planning-scenarios.repository';
import { CreatePlanningScenarioDto } from './dto/create-planning-scenario.dto';
import { UpdatePlanningScenarioDto } from './dto/update-planning-scenario.dto';

@Injectable()
export class PlanningScenariosService {
  constructor(private readonly repo: PlanningScenariosRepository) {}

  list(orgId: string) {
    return this.repo.findAll(orgId);
  }

  findById(orgId: string, id: string) {
    return this.repo.findById(orgId, id);
  }

  findDefault(orgId: string) {
    return this.repo.findDefault(orgId);
  }

  create(orgId: string, dto: CreatePlanningScenarioDto) {
    return this.repo.create(orgId, dto);
  }

  update(orgId: string, id: string, dto: UpdatePlanningScenarioDto) {
    return this.repo.update(orgId, id, dto);
  }

  delete(orgId: string, id: string) {
    return this.repo.delete(orgId, id);
  }
}
