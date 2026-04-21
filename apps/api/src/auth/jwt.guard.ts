import { ExecutionContext,Injectable,Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppModeService } from '../app-mode/app-mode.service';
import { DEMO_ORG_ID } from '../demo/demo.constants';

/**
 * JWT Authentication Guard.
 *
 * When DEMO_MODE=true, this guard is bypassed entirely and a synthetic
 * demo user is injected into the request context.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly appModeService: AppModeService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    // Internal demo bypass: requires explicit non-production flag + secret key.
    // Missing/invalid key falls back to normal JWT validation.
    if (this.appModeService.isAuthBypassEnabled()) {
      const bypassKey = this.appModeService.getAuthBypassKey();
      const providedKey = String(req.headers?.['x-demo-key'] ?? '').trim();
      if (!bypassKey || providedKey !== bypassKey) {
        this.logger.warn('Auth bypass denied: missing/invalid x-demo-key');
        return super.canActivate(context);
      }

      // Inject synthetic demo user into request
      req.user = {
        sub: 'demo-user',
        org_id: DEMO_ORG_ID,
        roles: ['admin'],
      };

      this.logger.debug('[DEMO] Auth bypassed, injected demo user');
      return true;
    }

    // Production: normal JWT validation
    return super.canActivate(context);
  }
}
