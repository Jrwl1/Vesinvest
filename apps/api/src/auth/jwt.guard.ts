import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { DEMO_ORG_ID } from '../demo/demo.constants';
import { AppModeService } from '../app-mode/app-mode.service';

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
    // DEMO_MODE: bypass JWT auth entirely
    if (this.appModeService.isAuthBypassEnabled()) {
      const req = context.switchToHttp().getRequest();
      
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
