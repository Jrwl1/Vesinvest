import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  const mockPrisma: any = {
    role: { upsert: jest.fn() },
    invitation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: { upsert: jest.fn() },
    userRole: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: InvitationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvitationsService(mockPrisma);
  });

  it('creates invitation for admin role and returns token in non-production', async () => {
    const expiresAt = new Date('2030-01-01T00:00:00.000Z');
    mockPrisma.invitation.create.mockResolvedValue({
      id: 'inv-1',
      orgId: 'org-1',
      email: 'user@example.com',
      role: 'USER',
      expiresAt,
    });

    const result = await service.createInvitation(
      'org-1',
      'admin-1',
      ['ADMIN'],
      { email: 'user@example.com' },
    );

    expect(mockPrisma.invitation.create).toHaveBeenCalledTimes(1);
    expect(result.orgId).toBe('org-1');
    expect(result.inviteToken).toBeDefined();
  });

  it('accepts invitation and returns principal context', async () => {
    const future = new Date(Date.now() + 3600_000);
    mockPrisma.invitation.findFirst.mockResolvedValue({
      id: 'inv-1',
      orgId: 'org-1',
      email: 'user@example.com',
      role: 'USER',
      acceptedAt: null,
      expiresAt: future,
    });
    mockPrisma.user.upsert.mockResolvedValue({ id: 'user-1' });
    mockPrisma.role.upsert.mockResolvedValue({ id: 'role-1', name: 'USER' });
    mockPrisma.userRole.findUnique.mockResolvedValue(null);
    mockPrisma.userRole.create.mockResolvedValue({});
    mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
    mockPrisma.invitation.update.mockResolvedValue({});

    const result = await service.acceptInvitation({
      token: 'raw-token',
      password: 'verysecret',
    });

    expect(result).toEqual({ userId: 'user-1', orgId: 'org-1', roles: ['USER'] });
  });
});

