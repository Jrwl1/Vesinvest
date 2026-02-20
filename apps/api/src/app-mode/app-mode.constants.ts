export const APP_MODES = ['production', 'trial', 'internal_demo'] as const;

export type AppMode = (typeof APP_MODES)[number];

export interface AppModeReason {
  appMode: AppMode;
  reason: string;
}

function isValidAppMode(value: string): value is AppMode {
  return (APP_MODES as readonly string[]).includes(value);
}

export function resolveAppModeFromEnv(): AppMode {
  const configuredRaw = process.env.APP_MODE?.trim();
  const configured =
    configuredRaw && configuredRaw !== 'undefined' && configuredRaw !== 'null'
      ? configuredRaw
      : '';
  if (configured) {
    if (!isValidAppMode(configured)) {
      throw new Error(
        `Invalid APP_MODE="${configured}". Allowed values: ${APP_MODES.join(', ')}`,
      );
    }
    return configured;
  }

  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.DEMO_MODE === 'true') return 'internal_demo';
  return 'trial';
}

export function getAppModeReason(): AppModeReason {
  const configuredRaw = process.env.APP_MODE?.trim();
  const configured =
    configuredRaw && configuredRaw !== 'undefined' && configuredRaw !== 'null'
      ? configuredRaw
      : '';
  if (configured && isValidAppMode(configured)) {
    return { appMode: configured, reason: `APP_MODE=${configured}` };
  }

  if (process.env.NODE_ENV === 'production') {
    return { appMode: 'production', reason: 'NODE_ENV=production (default)' };
  }

  if (process.env.DEMO_MODE === 'true') {
    return { appMode: 'internal_demo', reason: 'DEMO_MODE=true (legacy fallback)' };
  }

  return { appMode: 'trial', reason: 'default non-production mode' };
}

export function isInternalDemoMode(): boolean {
  return resolveAppModeFromEnv() === 'internal_demo';
}

export function isAuthBypassEnabled(): boolean {
  return isInternalDemoMode();
}
