import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { DEMO_ORG_ID } from '../demo/demo.constants';
import { AppModeService } from '../app-mode/app-mode.service';
import { DemoBootstrapService } from '../demo/demo-bootstrap.service';
import { LegalService } from '../legal/legal.service';
import { TrialService } from '../trial/trial.service';

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
 * so tenant-scoped writes always target a valid organization after reset.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private readonly demoBootstrap: DemoBootstrapService,
    private readonly appModeService: AppModeService,
    private readonly legalService: LegalService,
    private readonly trialService: TrialService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const appMode = this.appModeService.getMode();

    // DEMO_MODE: use deterministic demo org ID and ensure org exists (e.g. after demo reset)
    if (appMode === 'internal_demo') {
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

    if (appMode === 'trial') {
      await this.trialService.assertTrialAccessAllowed(orgId);
    }

    const path = String(req.path || req.url || '');
    const bypassLegalGate = path.startsWith('/legal');
    if (!bypassLegalGate) {
      const adminAccepted = await this.legalService.hasOrgAdminAcceptedCurrent(orgId);
      if (!adminAccepted) {
        throw new UnauthorizedException('Organization admin must accept legal terms before use');
      }

      const userId = req.user?.sub;
      if (userId) {
        const userAccepted = await this.legalService.hasUserAcceptedCurrent(orgId, userId);
        if (!userAccepted) {
          throw new UnauthorizedException('You must accept legal terms before use');
        }
      }
    }

    this.logger.debug(`[TENANT] Resolved orgId=${orgId} from JWT (user: ${req.user?.sub || 'unknown'})`);

    return true;
  }
}
