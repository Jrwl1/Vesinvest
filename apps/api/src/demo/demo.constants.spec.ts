import { isDemoModeEnabled, getDemoModeReason } from './demo.constants';

describe('demo.constants', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origDemoMode = process.env.DEMO_MODE;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    process.env.DEMO_MODE = origDemoMode;
  });

  describe('isDemoModeEnabled', () => {
    it('returns false when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEMO_MODE = '';
      expect(isDemoModeEnabled()).toBe(false);
    });

    it('returns true in dev when DEMO_MODE is not set', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.DEMO_MODE;
      expect(isDemoModeEnabled()).toBe(true);
    });

    it('returns false in dev when DEMO_MODE=false', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEMO_MODE = 'false';
      expect(isDemoModeEnabled()).toBe(false);
    });

    it('returns true in dev when DEMO_MODE=true', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEMO_MODE = 'true';
      expect(isDemoModeEnabled()).toBe(true);
    });
  });

  describe('getDemoModeReason', () => {
    it('returns disabled reason when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      expect(getDemoModeReason()).toEqual({ enabled: false, reason: 'NODE_ENV=production' });
    });

    it('returns disabled reason when DEMO_MODE=false', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEMO_MODE = 'false';
      expect(getDemoModeReason()).toEqual({ enabled: false, reason: 'DEMO_MODE=false' });
    });

    it('returns enabled reason when dev and DEMO_MODE not false', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.DEMO_MODE;
      const r = getDemoModeReason();
      expect(r.enabled).toBe(true);
      expect(r.reason).toMatch(/NODE_ENV|default/);
    });
  });
});
