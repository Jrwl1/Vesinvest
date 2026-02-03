import { PartialType } from '@nestjs/mapped-types';
import { CreateMappingDto } from './create-mapping.dto';

export class UpdateMappingDto extends PartialType(CreateMappingDto) {}
