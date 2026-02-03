import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportsRepository } from './imports.repository';
import { ImportExecutionService } from './import-execution.service';
import { ImportValidationService } from './import-validation.service';
import { MappingsModule } from '../mappings/mappings.module';

@Module({
  imports: [PrismaModule, forwardRef(() => MappingsModule)],
  controllers: [ImportsController],
  providers: [ImportsService, ImportsRepository, ImportExecutionService, ImportValidationService],
  exports: [ImportsService, ImportsRepository, ImportExecutionService, ImportValidationService],
})
export class ImportsModule {}
