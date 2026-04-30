import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

type RoleRequestUser = {
  roles?: string[];
};

function hasAnyRole(user: RoleRequestUser | undefined, allowedRoles: string[]) {
  const allowed = new Set(allowedRoles.map((role) => role.toUpperCase()));
  return (user?.roles ?? []).some((role) => allowed.has(role.toUpperCase()));
}

@Injectable()
export class V2AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as RoleRequestUser | undefined;
    if (hasAnyRole(user, ['ADMIN'])) {
      return true;
    }
    throw new ForbiddenException('V2 admin access is required.');
  }
}

@Injectable()
export class V2EditorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as RoleRequestUser | undefined;
    if (hasAnyRole(user, ['ADMIN', 'USER'])) {
      return true;
    }
    throw new ForbiddenException('V2 editor access is required.');
  }
}
