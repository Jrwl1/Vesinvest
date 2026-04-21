import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DemoInfraModule } from '../demo/demo-infra.module';
import { LegalModule } from '../legal/legal.module';
import { TrialModule } from '../trial/trial.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DemoService } from './demo.service';
import { InvitationsService } from './invitations.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    DemoInfraModule, // DemoService uses DemoBootstrapService when DEMO_MODE
    LegalModule,
    TrialModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev_secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, DemoService, InvitationsService, JwtStrategy],
})
export class AuthModule {}
