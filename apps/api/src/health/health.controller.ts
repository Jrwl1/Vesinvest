import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppModeService } from '../app-mode/app-mode.service';
import { DEMO_ORG_ID } from '../demo/demo.constants';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appModeService: AppModeService,
  ) {}

  // Liveness probe - no DB, just confirms Nest is up
  @Get('live')
  live() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  // Readiness probe - checks DB connectivity
  @Get()
  async check() {
    if (!this.prisma.isDbReady) {
      throw new HttpException(
        { status: 'degraded', db: 'down', time: new Date().toISOString() },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'ok', time: new Date().toISOString() };
    } catch {
      throw new HttpException(
        { status: 'degraded', db: 'down', time: new Date().toISOString() },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Public endpoint to expose runtime configuration.
   * Frontend uses this to detect demo mode without needing env vars.
   */
  @Get('config')
  config() {
    const appMode = this.appModeService.getMode();
    const demoMode = appMode === 'internal_demo';
    return {
      appMode,
      authBypassEnabled: this.appModeService.isAuthBypassEnabled(),
      demoLoginEnabled: this.appModeService.isDemoLoginEnabled(),
      demoMode,
      demoOrgId: demoMode ? DEMO_ORG_ID : null,
      time: new Date().toISOString(),
    };
  }
}
