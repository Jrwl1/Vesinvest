import { Controller, Post, Get, ForbiddenException } from '@nestjs/common';
import { DemoResetService } from './demo-reset.service';
import { DemoStatusService } from './demo-status.service';
import { DEMO_ORG_ID } from './demo.constants';

/**
 * Controller for demo status and reset. No auth required for GET /demo/status.
 * Response shape is stable: { enabled: boolean }. Never throws for status.
 */
@Controller('demo')
export class DemoController {
  constructor(
    private readonly resetService: DemoResetService,
    private readonly statusService: DemoStatusService,
  ) {}

  /**
   * Check if demo mode is enabled. Source of truth: process.env.DEMO_MODE === 'true'.
   * No auth. Never throws. Returns { enabled: true } or { enabled: false }.
   */
  @Get('status')
  getDemoStatus(): { enabled: boolean; orgId?: string | null; message?: string } {
    const enabled = this.statusService.isDemoMode();
    return {
      enabled,
      orgId: enabled ? DEMO_ORG_ID : null,
      message: enabled
        ? 'Demo mode is active. Sites must be created manually or via import.'
        : 'Demo mode is not enabled.',
    };
  }

  /**
   * Reset all demo data to a clean state. Only works when DEMO_MODE=true.
   */
  @Post('reset')
  async resetDemoData() {
    if (!this.statusService.isDemoMode()) {
      throw new ForbiddenException('Demo reset is only available in DEMO_MODE');
    }
    return this.resetService.resetDemoData();
  }
}
