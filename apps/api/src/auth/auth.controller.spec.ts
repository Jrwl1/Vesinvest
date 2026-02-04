import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { demoLogin: jest.Mock };

  beforeEach(async () => {
    authService = { demoLogin: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('POST /auth/demo-login', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDemoMode = process.env.DEMO_MODE;
    const originalDemoKey = process.env.DEMO_KEY;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.DEMO_MODE = originalDemoMode;
      process.env.DEMO_KEY = originalDemoKey;
    });

    it('returns 200 and body contains accessToken when demo mode enabled (dev)', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DEMO_MODE = '';
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
      process.env.NODE_ENV = 'production';
      process.env.DEMO_MODE = '';
      process.env.DEMO_KEY = '';

      await expect(
        controller.demoLogin({ ip: '127.0.0.1', headers: {} } as any),
      ).rejects.toThrow(NotFoundException);
      expect(authService.demoLogin).not.toHaveBeenCalled();
    });

    it('returns 404 when DEMO_MODE=false in dev', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DEMO_MODE = 'false';
      process.env.DEMO_KEY = '';

      await expect(
        controller.demoLogin({ ip: '127.0.0.1', headers: {} } as any),
      ).rejects.toThrow(NotFoundException);
      expect(authService.demoLogin).not.toHaveBeenCalled();
    });
  });
});
