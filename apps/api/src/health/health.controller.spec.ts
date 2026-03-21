import { HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const appModeService = {
    getMode: jest.fn(() => 'production'),
    isProduction: jest.fn(() => true),
    isAuthBypassEnabled: jest.fn(() => false),
    isDemoLoginEnabled: jest.fn(() => false),
  };

  it('returns a minimal liveness payload', () => {
    const controller = new HealthController(
      { isDbReady: true, $queryRaw: jest.fn() } as any,
      appModeService as any,
    );

    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('returns a minimal readiness payload when the database is ready', async () => {
    const controller = new HealthController(
      { isDbReady: true, $queryRaw: jest.fn().mockResolvedValue([1]) } as any,
      appModeService as any,
    );

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  });

  it('fails readiness without exposing db internals', async () => {
    const controller = new HealthController(
      { isDbReady: false, $queryRaw: jest.fn() } as any,
      appModeService as any,
    );

    await expect(controller.check()).rejects.toEqual(
      expect.objectContaining({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        response: { status: 'degraded' },
      }),
    );
  });
});
