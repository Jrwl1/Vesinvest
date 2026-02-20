import { Injectable } from '@nestjs/common';
import {
  AppMode,
  getAppModeReason,
  resolveAppModeFromEnv,
  isAuthBypassEnabled,
} from './app-mode.constants';

@Injectable()
export class AppModeService {
  getMode(): AppMode {
    return resolveAppModeFromEnv();
  }

  getModeReason() {
    return getAppModeReason();
  }

  isInternalDemo(): boolean {
    return this.getMode() === 'internal_demo';
  }

  isTrial(): boolean {
    return this.getMode() === 'trial';
  }

  isProduction(): boolean {
    return this.getMode() === 'production';
  }

  isAuthBypassEnabled(): boolean {
    return isAuthBypassEnabled();
  }

  isDemoLoginEnabled(): boolean {
    return this.isInternalDemo();
  }
}

