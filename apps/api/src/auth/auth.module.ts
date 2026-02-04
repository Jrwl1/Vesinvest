import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DemoService } from './demo.service';
import { JwtStrategy } from './jwt.strategy';
import { DemoInfraModule } from '../demo/demo-infra.module';

@Module({
  imports: [
    DemoInfraModule, // DemoService uses DemoBootstrapService when DEMO_MODE
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev_secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, DemoService, JwtStrategy],
})
export class AuthModule {}