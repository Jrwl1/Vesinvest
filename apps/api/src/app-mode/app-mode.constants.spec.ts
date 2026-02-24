import {
  getAppModeReason,
  isAuthBypassEnabled,
  resolveAppModeFromEnv,
} from './app-mode.constants';

describe('app-mode.constants', () => {
  const original = {
    appMode: process.env.APP_MODE,
    nodeEnv: process.env.NODE_ENV,
    demoMode: process.env.DEMO_MODE,
    authBypass: process.env.AUTH_BYPASS,
    authBypassKey: process.env.AUTH_BYPASS_KEY,
  };

  afterEach(() => {
    process.env.APP_MODE = original.appMode;
    process.env.NODE_ENV = original.nodeEnv;
    process.env.DEMO_MODE = original.demoMode;
    process.env.AUTH_BYPASS = original.authBypass;
    process.env.AUTH_BYPASS_KEY = original.authBypassKey;
  });

  it('uses APP_MODE when explicitly configured', () => {
    process.env.APP_MODE = 'internal_demo';
    expect(resolveAppModeFromEnv()).toBe('internal_demo');
  });

  it('defaults to production in production when APP_MODE missing', () => {
    delete process.env.APP_MODE;
    process.env.NODE_ENV = 'production';
    expect(resolveAppModeFromEnv()).toBe('production');
  });

  it('defaults to trial in non-production when APP_MODE and DEMO_MODE are missing', () => {
    delete process.env.APP_MODE;
    process.env.NODE_ENV = 'development';
    delete process.env.DEMO_MODE;
    expect(resolveAppModeFromEnv()).toBe('trial');
  });

  it('falls back to internal_demo with legacy DEMO_MODE=true', () => {
    delete process.env.APP_MODE;
    process.env.NODE_ENV = 'development';
    process.env.DEMO_MODE = 'true';
    expect(resolveAppModeFromEnv()).toBe('internal_demo');
    expect(getAppModeReason().reason).toContain('DEMO_MODE=true');
  });

  it('requires explicit auth bypass flag and key in internal_demo', () => {
    process.env.APP_MODE = 'internal_demo';
    process.env.NODE_ENV = 'development';
    delete process.env.AUTH_BYPASS;
    delete process.env.AUTH_BYPASS_KEY;
    expect(isAuthBypassEnabled()).toBe(false);

    process.env.AUTH_BYPASS = 'true';
    expect(isAuthBypassEnabled()).toBe(false);

    process.env.AUTH_BYPASS_KEY = 'demo-secret';
    expect(isAuthBypassEnabled()).toBe(true);
  });

  it('never enables auth bypass in production', () => {
    process.env.APP_MODE = 'internal_demo';
    process.env.NODE_ENV = 'production';
    process.env.AUTH_BYPASS = 'true';
    process.env.AUTH_BYPASS_KEY = 'demo-secret';
    expect(isAuthBypassEnabled()).toBe(false);
  });
});
