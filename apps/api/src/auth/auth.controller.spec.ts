import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AppModeService } from '../app-mode/app-mode.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvitationsService } from './invitations.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { demoLogin: jest.Mock };
  let appModeService: { isDemoLoginEnabled: jest.Mock };

  beforeEach(async () => {
    authService = { demoLogin: jest.fn() };
    appModeService = { isDemoLoginEnabled: jest.fn(() => true) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: InvitationsService,
          useValue: { createInvitation: jest.fn(), acceptInvitation: jest.fn() },
        },
        {
          provide: AppModeService,
          useValue: appModeService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('POST /auth/demo-login', () => {
    const originalDemoKey = process.env.DEMO_KEY;

    afterEach(() => {
      process.env.DEMO_KEY = originalDemoKey;
    });

    it('returns 200 and body contains accessToken when demo mode enabled (dev)', async () => {
      appModeService.isDemoLoginEnabled.mockReturnValue(true);
      process.env.DEMO_KEY = '';
      authService.demoLogin.mockResolvedValue({
        accessToken: 'jwt-token-here',
        orgId: 'demo-org-id',
      });

      const req = { ip: '127.0.0.1', headers: {} };
      const result = await controller.demoLogin(req as any);

      expect(result).toEqual({ accessToken: 'jwt-token-here', orgId: 'demo-org-id' });
      expect(authService.demoLogin).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when demo mode disabled (production)', async () => {
      appModeService.isDemoLoginEnabled.mockReturnValue(false);
      process.env.DEMO_KEY = '';

      await expect(
        controller.demoLogin({ ip: '127.0.0.1', headers: {} } as any),
      ).rejects.toThrow(NotFoundException);
      expect(authService.demoLogin).not.toHaveBeenCalled();
    });
  });
});
