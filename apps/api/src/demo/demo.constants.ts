/**
 * Demo mode constants and config.
 * Pure values / functions only — no Nest dependencies.
 * Import this from anywhere (guards, services, controllers) without pulling in DemoModule.
 *
 * Rule: demo is ON in non-production unless DEMO_MODE is explicitly "false".
 * - NODE_ENV=production => always OFF (prod safety).
 * - NODE_ENV=development (or unset) and DEMO_MODE not "false" => ON (default for local/Cursor).
 * - DEMO_MODE=false => OFF (opt-out in dev).
 */

export const DEMO_ORG_ID = 'demo-org-00000000-0000-0000-0000-000000000001';

/**
 * True when demo mode is enabled: non-production and DEMO_MODE is not explicitly "false".
 */
export function isDemoModeEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.DEMO_MODE === 'false') return false;
  return true;
}

export interface DemoModeReason {
  enabled: boolean;
  reason: string;
}

/**
 * Returns enabled flag and a short reason for boot log.
 */
export function getDemoModeReason(): DemoModeReason {
  if (process.env.NODE_ENV === 'production') {
    return { enabled: false, reason: 'NODE_ENV=production' };
  }
  if (process.env.DEMO_MODE === 'false') {
    return { enabled: false, reason: 'DEMO_MODE=false' };
  }
  const envReason = process.env.DEMO_MODE === 'true'
    ? 'DEMO_MODE=true'
    : `NODE_ENV=${process.env.NODE_ENV ?? 'development'} (default)`;
  return { enabled: true, reason: envReason };
}
