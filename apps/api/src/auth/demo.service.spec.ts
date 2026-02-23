/**
 * DemoService.bootstrapDemo() must be idempotent: safe to call repeatedly.
 * UserRole is ensured via findUnique + create (no upsert) to avoid unique constraint errors.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DemoService } from './demo.service';
import { PrismaService } from '../prisma/prisma.service';
import { DemoBootstrapService } from '../demo/demo-bootstrap.service';
import { DEMO_ORG_ID } from '../demo/demo.constants';

jest.mock('../demo/demo.constants', () => ({
  ...jest.requireActual('../demo/demo.constants'),
  isDemoModeEnabled: jest.fn(() => true),
}));

const { isDemoModeEnabled } = jest.requireMock('../demo/demo.constants');

describe('DemoService', () => {
  let service: DemoService;
  const mockUser = {
    id: 'user-1',
    email: 'admin@vesipolku.dev',
    password: 'hash',
  };
  const mockRole = { id: 'role-1', name: 'ADMIN' };
  const mockUserRole = {
    id: 'ur-1',
    user_id: mockUser.id,
    role_id: mockRole.id,
    org_id: DEMO_ORG_ID,
  };

  const mockPrisma = {
    role: { upsert: jest.fn() },
    user: { upsert: jest.fn() },
    userRole: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const mockDemoBootstrap = {
    ensureDemoOrg: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (isDemoModeEnabled as jest.Mock).mockReturnValue(true);
    mockPrisma.role.upsert.mockResolvedValue(mockRole);
    mockPrisma.user.upsert.mockResolvedValue(mockUser);
    mockPrisma.userRole.findUnique.mockResolvedValue(null);
    mockPrisma.userRole.create.mockResolvedValue(mockUserRole);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DemoBootstrapService, useValue: mockDemoBootstrap },
      ],
    }).compile();

    service = module.get<DemoService>(DemoService);
  });

  describe('bootstrapDemo (demo mode)', () => {
    it('calls ensureUserRole via findUnique then create when link missing', async () => {
      const result = await service.bootstrapDemo();

      expect(result).toEqual({
        userId: mockUser.id,
        orgId: DEMO_ORG_ID,
        roles: ['ADMIN'],
      });
      expect(mockPrisma.userRole.findUnique).toHaveBeenCalledWith({
        where: {
          user_id_role_id_org_id: {
            user_id: mockUser.id,
            role_id: mockRole.id,
            org_id: DEMO_ORG_ID,
          },
        },
      });
      expect(mockPrisma.userRole.create).toHaveBeenCalledTimes(1);
    });

    it('is idempotent: second call does not create duplicate UserRole', async () => {
      const r1 = await service.bootstrapDemo();
      expect(mockPrisma.userRole.create).toHaveBeenCalledTimes(1);

      mockPrisma.userRole.findUnique.mockResolvedValue(mockUserRole);

      const r2 = await service.bootstrapDemo();
      expect(r1.userId).toBe(r2.userId);
      expect(r1.orgId).toBe(r2.orgId);
      expect(mockPrisma.userRole.create).toHaveBeenCalledTimes(1);
    });
  });
});
