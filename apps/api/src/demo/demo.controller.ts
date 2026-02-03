import { Controller, Post, Get, ForbiddenException } from '@nestjs/common';
import { DemoResetService } from './demo-reset.service';
import { isDemoModeEnabled, DEMO_ORG_ID } from './demo.module';

/**
 * Controller for demo-mode-only operations.
 * All endpoints require DEMO_MODE=true.
 */
@Controller('demo')
export class DemoController {
  constructor(private readonly resetService: DemoResetService) {}

  /**
   * Check if demo mode is enabled and get demo org info.
   * This endpoint works even in non-demo mode (returns { enabled: false }).
   */
  @Get('status')
  getDemoStatus() {
    const enabled = isDemoModeEnabled();
    return {
      enabled,
      orgId: enabled ? DEMO_ORG_ID : null,
      message: enabled
        ? 'Demo mode is active. Sites must be created manually or via import.'
        : 'Demo mode is not enabled.',
    };
  }

  /**
   * Reset all demo data to a clean state.
   * Only works when DEMO_MODE=true.
   * 
   * Deletes: sites, assets, imports, mappings, maintenance items, etc.
   * Recreates: asset types only (per Site Handling Contract).
   */
  @Post('reset')
  async resetDemoData() {
    if (!isDemoModeEnabled()) {
      throw new ForbiddenException('Demo reset is only available in DEMO_MODE');
    }

    return this.resetService.resetDemoData();
  }
}
