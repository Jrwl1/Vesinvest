import { Injectable } from '@nestjs/common';
import { isDemoModeEnabled } from './demo.constants';

/**
 * Source of truth for demo mode: delegates to demo.constants (NODE_ENV + DEMO_MODE).
 */
@Injectable()
export class DemoStatusService {
  isDemoMode(): boolean {
    return isDemoModeEnabled();
  }
}
