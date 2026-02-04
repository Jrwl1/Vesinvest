import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { isDemoModeEnabled, DEMO_ORG_ID } from '../demo/demo.constants';
import { DemoBootstrapService } from '../demo/demo-bootstrap.service';

/**
 * TenantGuard extracts orgId from the authenticated user's JWT claims.
 *
 * SECURITY: The orgId is NEVER accepted from client input (body, query, headers).
 * It is always derived from the JWT token which is signed and verified.
 *
 * Flow:
 * 1. JwtAuthGuard verifies the JWT and sets req.user = JWT payload
 * 2. TenantGuard extracts req.user.org_id and sets req.orgId
 * 3. Controllers use req.orgId for all tenant-scoped operations
 *
 * DEMO_MODE: When enabled, uses DEMO_ORG_ID and ensures demo org exists (idempotent)
 * so tenant-scoped writes never hit ExcelImport_orgId_fkey after reset.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly demoBootstrap: DemoBootstrapService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // DEMO_MODE: use deterministic demo org ID and ensure org exists (e.g. after demo reset)
    if (isDemoModeEnabled()) {
      await this.demoBootstrap.ensureDemoOrg();
      req.orgId = DEMO_ORG_ID;
      this.logger.debug(`[DEMO] Using demo orgId=${DEMO_ORG_ID}`);
      return true;
    }

    // SECURITY: orgId comes ONLY from JWT claims, never from client input
    const orgId = req.user?.org_id;

    if (!orgId) {
      this.logger.warn(`[SECURITY] Missing org_id in JWT for user ${req.user?.sub || 'unknown'}`);
      throw new UnauthorizedException('Missing org_id in token');
    }

    // Set orgId on request for downstream use
    req.orgId = orgId;

    this.logger.debug(`[TENANT] Resolved orgId=${orgId} from JWT (user: ${req.user?.sub || 'unknown'})`);

    return true;
  }
}