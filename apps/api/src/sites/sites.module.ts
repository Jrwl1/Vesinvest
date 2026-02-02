import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { SitesRepository } from './sites.repository';

@Module({
  imports: [PrismaModule],
  controllers: [SitesController],
  providers: [SitesService, SitesRepository],
})
export class SitesModule {}