/**
 * TenantGuard: in DEMO_MODE ensures demo org exists so tenant-scoped writes never hit FK.
 */

import { ExecutionContext } from '@nestjs/common';
import { DemoBootstrapService } from '../demo/demo-bootstrap.service';
import { DEMO_ORG_ID } from '../demo/demo.constants';
import { AppModeService } from '../app-mode/app-mode.service';
import { LegalService } from '../legal/legal.service';
import { TrialService } from '../trial/trial.service';

jest.mock('../demo/demo.constants', () => ({
  ...jest.requireActual('../demo/demo.constants'),
  isDemoModeEnabled: jest.fn(() => true),
}));

import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let mockBootstrap: jest.Mocked<DemoBootstrapService>;
  let mockMode: jest.Mocked<AppModeService>;
  let mockLegal: jest.Mocked<LegalService>;
  let mockTrial: jest.Mocked<TrialService>;

  const mockContext = (req: object): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    mockBootstrap = { ensureDemoOrg: jest.fn().mockResolvedValue(undefined) } as any;
    mockMode = { getMode: jest.fn(() => 'internal_demo') } as any;
    mockLegal = {
      hasOrgAdminAcceptedCurrent: jest.fn().mockResolvedValue(true),
      hasUserAcceptedCurrent: jest.fn().mockResolvedValue(true),
    } as any;
    mockTrial = { assertTrialAccessAllowed: jest.fn().mockResolvedValue(undefined) } as any;
    guard = new TenantGuard(mockBootstrap, mockMode, mockLegal, mockTrial);
  });

  it('should call ensureDemoOrg and set req.orgId to DEMO_ORG_ID when DEMO_MODE is true', async () => {
    const req: any = {};
    const ctx = mockContext(req);

    const result = await guard.canActivate(ctx);

    expect(mockBootstrap.ensureDemoOrg).toHaveBeenCalled();
    expect(req.orgId).toBe(DEMO_ORG_ID);
    expect(result).toBe(true);
  });

  it('enforces trial and legal checks in non-demo modes', async () => {
    mockMode.getMode.mockReturnValue('trial');
    mockLegal.hasOrgAdminAcceptedCurrent.mockResolvedValue(true);
    const req: any = { user: { sub: 'u1', org_id: 'org-1', roles: ['ADMIN'] }, path: '/budgets' };
    const ctx = mockContext(req);

    const result = await guard.canActivate(ctx);

    expect(mockTrial.assertTrialAccessAllowed).toHaveBeenCalledWith('org-1');
    expect(mockLegal.hasOrgAdminAcceptedCurrent).toHaveBeenCalledWith('org-1');
    expect(mockLegal.hasUserAcceptedCurrent).toHaveBeenCalledWith('org-1', 'u1');
    expect(result).toBe(true);
    expect(req.orgId).toBe('org-1');
  });
});
