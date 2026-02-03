import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImportsModule } from '../imports/imports.module';
import { MappingsController } from './mappings.controller';
import { MappingsService } from './mappings.service';
import { MappingsRepository } from './mappings.repository';

@Module({
  imports: [PrismaModule, forwardRef(() => ImportsModule)],
  controllers: [MappingsController],
  providers: [MappingsService, MappingsRepository],
  exports: [MappingsService, MappingsRepository],
})
export class MappingsModule {}
