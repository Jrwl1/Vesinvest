import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AppModeService } from '../app-mode/app-mode.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvitationsService } from './invitations.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    demoLogin: jest.Mock;
    devToken: jest.Mock;
    login: jest.Mock;
  };
  let appModeService: { isDemoLoginEnabled: jest.Mock };

  beforeEach(async () => {
    authService = {
      demoLogin: jest.fn(),
      devToken: jest.fn(),
      login: jest.fn(),
    };
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
          useValue: {
            createInvitation: jest.fn(),
            acceptInvitation: jest.fn(),
          },
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

      expect(result).toEqual({
        accessToken: 'jwt-token-here',
        orgId: 'demo-org-id',
      });
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

  describe('POST /auth/dev-token', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalBypass = process.env.DEV_AUTH_BYPASS;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.DEV_AUTH_BYPASS = originalBypass;
    });

    it('returns 404 in production even when bypass flag is set', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DEV_AUTH_BYPASS = 'true';

      await expect(controller.devToken()).rejects.toThrow(NotFoundException);
      expect(authService.devToken).not.toHaveBeenCalled();
    });

    it('returns dev token in non-production only when bypass flag is enabled', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_AUTH_BYPASS = 'true';
      authService.devToken.mockResolvedValue({ accessToken: 'dev-token' });

      await expect(controller.devToken()).resolves.toEqual({
        accessToken: 'dev-token',
      });
      expect(authService.devToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /auth/login', () => {
    it('blocks repeated failed attempts with 429 on the 5th try', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );
      const dto = {
        email: 'rate-limit-test@jrwl.io',
        password: 'wrong-password',
      };
      const req = { ip: '198.51.100.101', headers: {} } as any;

      for (let i = 0; i < 4; i += 1) {
        await expect(controller.login(req, dto as any)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      }

      await expect(controller.login(req, dto as any)).rejects.toMatchObject({
        status: 429,
      });
      expect(authService.login).toHaveBeenCalledTimes(5);
    });

    it('clears failed-attempt throttle after successful login', async () => {
      authService.login.mockImplementation(
        async (_email: string, password: string) => {
          if (password === 'correct-password') {
            return {
              accessToken: 'token',
              user: { userId: 'u1', orgId: 'org-1', roles: ['ADMIN'] },
            };
          }
          throw new UnauthorizedException('Invalid credentials');
        },
      );

      const req = { ip: '198.51.100.102', headers: {} } as any;
      const email = 'reset-limit-test@jrwl.io';

      for (let i = 0; i < 4; i += 1) {
        await expect(
          controller.login(req, { email, password: 'wrong-password' } as any),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }

      await expect(
        controller.login(req, {
          email,
          password: 'correct-password',
        } as any),
      ).resolves.toMatchObject({
        accessToken: 'token',
      });

      for (let i = 0; i < 4; i += 1) {
        await expect(
          controller.login(req, { email, password: 'wrong-password' } as any),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
    });

    it('does not trust spoofed forwarded headers when throttling login attempts', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );
      const dto = {
        email: 'xff-spoof-test@jrwl.io',
        password: 'wrong-password',
      };
      const ip = '198.51.100.150';

      for (let i = 0; i < 4; i += 1) {
        await expect(
          controller.login(
            {
              ip,
              headers: { 'x-forwarded-for': `203.0.113.${i + 1}` },
            } as any,
            dto as any,
          ),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }

      await expect(
        controller.login(
          {
            ip,
            headers: { 'x-forwarded-for': '203.0.113.250' },
          } as any,
          dto as any,
        ),
      ).rejects.toMatchObject({
        status: 429,
      });
    });

    it('fails closed in edge mode when trusted edge verification is missing', async () => {
      const originalMode = process.env.AUTH_RATE_LIMIT_MODE;
      const originalSecret = process.env.AUTH_EDGE_RATE_LIMIT_SECRET;
      process.env.AUTH_RATE_LIMIT_MODE = 'edge';
      process.env.AUTH_EDGE_RATE_LIMIT_SECRET = 'edge-secret';
      authService.login.mockResolvedValue({
        accessToken: 'token',
        user: { userId: 'u1', orgId: 'org-1', roles: ['ADMIN'] },
      });

      try {
        await expect(
          controller.login(
            {
              ip: '198.51.100.160',
              headers: {},
            } as any,
            {
              email: 'edge-mode-test@jrwl.io',
              password: 'correct-password',
            } as any,
          ),
        ).rejects.toMatchObject({
          status: 503,
        });
        expect(authService.login).not.toHaveBeenCalled();
      } finally {
        process.env.AUTH_RATE_LIMIT_MODE = originalMode;
        process.env.AUTH_EDGE_RATE_LIMIT_SECRET = originalSecret;
      }
    });

    it('accepts login in edge mode when trusted edge verification matches', async () => {
      const originalMode = process.env.AUTH_RATE_LIMIT_MODE;
      const originalSecret = process.env.AUTH_EDGE_RATE_LIMIT_SECRET;
      process.env.AUTH_RATE_LIMIT_MODE = 'edge';
      process.env.AUTH_EDGE_RATE_LIMIT_SECRET = 'edge-secret';
      authService.login.mockResolvedValue({
        accessToken: 'token',
        user: { userId: 'u1', orgId: 'org-1', roles: ['ADMIN'] },
      });

      try {
        await expect(
          controller.login(
            {
              ip: '198.51.100.161',
              headers: { 'x-auth-rate-limit-verified': 'edge-secret' },
            } as any,
            {
              email: 'edge-mode-pass@jrwl.io',
              password: 'correct-password',
            } as any,
          ),
        ).resolves.toMatchObject({
          accessToken: 'token',
        });
      } finally {
        process.env.AUTH_RATE_LIMIT_MODE = originalMode;
        process.env.AUTH_EDGE_RATE_LIMIT_SECRET = originalSecret;
      }
    });
  });
});
