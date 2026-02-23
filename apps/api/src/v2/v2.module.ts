import { Module } from '@nestjs/common';
import { ProjectionsModule } from '../projections/projections.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VeetiModule } from '../veeti/veeti.module';
import { V2Controller } from './v2.controller';
import { V2Service } from './v2.service';

@Module({
  imports: [PrismaModule, ProjectionsModule, VeetiModule],
  controllers: [V2Controller],
  providers: [V2Service],
})
export class V2Module {}
