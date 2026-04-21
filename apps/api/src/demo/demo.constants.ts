import { getAppModeReason,isInternalDemoMode } from '../app-mode/app-mode.constants';

/**
 * Demo constants are kept for backwards compatibility with existing imports.
 */
export const DEMO_ORG_ID = 'demo-org-00000000-0000-0000-0000-000000000001';

export function isDemoModeEnabled(): boolean {
  return isInternalDemoMode();
}

export interface DemoModeReason {
  enabled: boolean;
  reason: string;
}

export function getDemoModeReason(): DemoModeReason {
  const modeReason = getAppModeReason();
  return {
    enabled: modeReason.appMode === 'internal_demo',
    reason: modeReason.reason,
  };
}

