import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const orgId = req.user?.org_id;
    if (!orgId) throw new UnauthorizedException('Missing org_id');
    req.orgId = orgId;
    return true;
  }
}