/**
 * TenantGuard: in DEMO_MODE ensures demo org exists so tenant-scoped writes never hit FK.
 */

import { ExecutionContext } from '@nestjs/common';
import { DemoBootstrapService } from '../demo/demo-bootstrap.service';
import { DEMO_ORG_ID } from '../demo/demo.constants';

jest.mock('../demo/demo.constants', () => ({
  ...jest.requireActual('../demo/demo.constants'),
  isDemoModeEnabled: jest.fn(() => true),
}));

import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let mockBootstrap: jest.Mocked<DemoBootstrapService>;

  const mockContext = (req: object): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    mockBootstrap = { ensureDemoOrg: jest.fn().mockResolvedValue(undefined) } as any;
    guard = new TenantGuard(mockBootstrap);
  });

  it('should call ensureDemoOrg and set req.orgId to DEMO_ORG_ID when DEMO_MODE is true', async () => {
    const req: any = {};
    const ctx = mockContext(req);

    const result = await guard.canActivate(ctx);

    expect(mockBootstrap.ensureDemoOrg).toHaveBeenCalled();
    expect(req.orgId).toBe(DEMO_ORG_ID);
    expect(result).toBe(true);
  });
});
