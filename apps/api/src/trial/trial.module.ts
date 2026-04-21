import { Global,Module } from '@nestjs/common';
import { DemoInfraModule } from '../demo/demo-infra.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TrialController } from './trial.controller';
import { TrialService } from './trial.service';

@Global()
@Module({
  imports: [PrismaModule, DemoInfraModule],
  controllers: [TrialController],
  providers: [TrialService],
  exports: [TrialService],
})
export class TrialModule {}
