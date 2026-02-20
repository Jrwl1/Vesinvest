/**
 * Demo controller: GET /demo/status, POST /demo/seed, POST /demo/reset.
 * - POST /demo/seed returns 404 when demo mode is disabled.
 * - POST /demo/seed returns 200 and seed result when demo mode is enabled.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { DemoResetService } from './demo-reset.service';
import { DemoStatusService } from './demo-status.service';
import { DemoBootstrapService } from './demo-bootstrap.service';

jest.mock('./demo.constants', () => ({
  ...jest.requireActual('./demo.constants'),
  isDemoModeEnabled: jest.fn(),
}));

const { isDemoModeEnabled } = jest.requireMock('./demo.constants');

describe('DemoController', () => {
  let controller: DemoController;
  const mockStatusService = {
    getStatus: jest.fn(() => ({
      enabled: true,
      appMode: 'internal_demo',
      authBypassEnabled: true,
      demoLoginEnabled: true,
    })),
  };
  const mockBootstrap = {
    seedDemoData: jest.fn().mockResolvedValue({ alreadySeeded: false, seededAt: new Date().toISOString(), created: { assumptions: 5, budget: true, projection: true } }),
  };
  const mockResetService = { resetDemoData: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DemoController],
      providers: [
        { provide: DemoResetService, useValue: mockResetService },
        { provide: DemoStatusService, useValue: mockStatusService },
        { provide: DemoBootstrapService, useValue: mockBootstrap },
      ],
    }).compile();

    controller = module.get<DemoController>(DemoController);
  });

  describe('POST /demo/seed', () => {
    it('returns 404 when demo mode is disabled', async () => {
      (isDemoModeEnabled as jest.Mock).mockReturnValue(false);

      await expect(controller.seedDemoData()).rejects.toThrow(NotFoundException);
      expect(mockBootstrap.seedDemoData).not.toHaveBeenCalled();
    });

    it('returns seed result when demo mode is enabled', async () => {
      (isDemoModeEnabled as jest.Mock).mockReturnValue(true);
      mockBootstrap.seedDemoData.mockResolvedValue({
        alreadySeeded: true,
        seededAt: '2026-01-01T00:00:00.000Z',
      });

      const result = await controller.seedDemoData();

      expect(mockBootstrap.seedDemoData).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ alreadySeeded: true, seededAt: '2026-01-01T00:00:00.000Z' });
    });
  });
});
