import { Controller, Post, Get, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DemoResetService } from './demo-reset.service';
import { DemoStatusService } from './demo-status.service';
import { DemoBootstrapService } from './demo-bootstrap.service';
import { DEMO_ORG_ID, isDemoModeEnabled } from './demo.constants';

/**
 * Controller for demo status, reset, and optional seed. No auth required for GET /demo/status.
 * POST /demo/seed and POST /demo/reset are demo-only (404 when demo disabled).
 */
@Controller('demo')
export class DemoController {
  constructor(
    private readonly resetService: DemoResetService,
    private readonly statusService: DemoStatusService,
    private readonly bootstrap: DemoBootstrapService,
  ) {}

  /**
   * Check if demo mode is enabled. Source of truth: process.env.DEMO_MODE === 'true'.
   * No auth. Never throws. Returns { enabled: true } or { enabled: false }.
   */
  @Get('status')
  getDemoStatus(): {
    enabled: boolean;
    appMode: 'production' | 'trial' | 'internal_demo';
    authBypassEnabled: boolean;
    demoLoginEnabled: boolean;
    orgId?: string | null;
    message?: string;
  } {
    const status = this.statusService.getStatus();
    const enabled = status.enabled;
    return {
      enabled,
      appMode: status.appMode,
      authBypassEnabled: status.authBypassEnabled,
      demoLoginEnabled: status.demoLoginEnabled,
      orgId: enabled ? DEMO_ORG_ID : null,
      message: enabled
        ? 'Demo mode is active. Sites must be created manually or via import.'
        : 'Demo mode is not enabled.',
    };
  }

  /**
   * Seed optional demo dataset (budget, assumptions, projection). Idempotent.
   * Only available when demo mode is enabled; returns 404 in production.
   * This is the ONLY way to create demo budgets/projections; never called automatically.
   */
  @Post('seed')
  async seedDemoData() {
    if (!isDemoModeEnabled()) {
      throw new NotFoundException('Demo seed is only available when demo mode is enabled');
    }
    return this.bootstrap.seedDemoData();
  }

  /**
   * Reset all demo data to a clean state. Only works when DEMO_MODE=true.
   */
  @Post('reset')
  async resetDemoData() {
    if (!this.statusService.getStatus().enabled) {
      throw new ForbiddenException('Demo reset is only available in DEMO_MODE');
    }
    return this.resetService.resetDemoData();
  }
}
