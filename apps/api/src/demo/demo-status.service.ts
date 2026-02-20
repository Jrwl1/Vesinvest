import { Injectable } from '@nestjs/common';
import { AppModeService } from '../app-mode/app-mode.service';

/**
 * Source of truth for runtime mode.
 */
@Injectable()
export class DemoStatusService {
  constructor(private readonly appModeService: AppModeService) {}

  getStatus() {
    const appMode = this.appModeService.getMode();
    const enabled = appMode === 'internal_demo';
    return {
      enabled,
      appMode,
      authBypassEnabled: this.appModeService.isAuthBypassEnabled(),
      demoLoginEnabled: this.appModeService.isDemoLoginEnabled(),
    };
  }
}
