import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanningScenarioDto } from './create-planning-scenario.dto';

export class UpdatePlanningScenarioDto extends PartialType(CreatePlanningScenarioDto) {}
