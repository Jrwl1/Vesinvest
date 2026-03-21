import { LegalController } from './legal.controller';

describe('LegalController', () => {
  it('uses the trusted request ip for legal acceptance metadata', async () => {
    const legalService = {
      acceptCurrent: jest.fn().mockResolvedValue({
        acceptedAt: '2026-03-21T00:00:00.000Z',
        termsVersion: 'terms-v1',
        dpaVersion: 'dpa-v1',
      }),
      getUserStatus: jest.fn().mockResolvedValue({
        requiresUserAcceptance: false,
        orgUnlocked: true,
        requiresOrgAdminAcceptance: false,
        waitingForAdmin: false,
      }),
    } as any;

    const controller = new LegalController(legalService);
    const req = {
      user: {
        sub: 'user-1',
        org_id: 'org-1',
        roles: ['ADMIN'],
      },
      ip: '198.51.100.77',
      headers: {
        'x-forwarded-for': '203.0.113.20',
        'user-agent': 'jest-agent',
      },
    };

    await controller.accept(req as any, {
      acceptTerms: true,
      acceptDpa: true,
    });

    expect(legalService.acceptCurrent).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
      ip: '198.51.100.77',
      userAgent: 'jest-agent',
    });
  });
});
