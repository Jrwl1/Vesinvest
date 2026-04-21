import { Injectable,UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt,Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub?: string;
  org_id?: string;
  roles?: string[];
}

const AUTH_MEMBERSHIP_CACHE_TTL_MS = 30_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly membershipCache = new Map<
    string,
    { expiresAt: number; roles: string[] }
  >();

  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'dev_secret',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub || !payload?.org_id) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const cacheKey = `${payload.sub}:${payload.org_id}`;
    const cached = this.membershipCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() && cached.roles.length > 0) {
      return {
        sub: payload.sub,
        org_id: payload.org_id,
        roles: cached.roles,
      };
    }
    if (cached) {
      this.membershipCache.delete(cacheKey);
    }

    const memberships = await this.prisma.userRole.findMany({
      where: {
        user_id: payload.sub,
        org_id: payload.org_id,
      },
      include: {
        role: true,
      },
    });

    if (memberships.length === 0) {
      throw new UnauthorizedException('User access revoked');
    }

    const roles = memberships.map((membership) => membership.role.name);
    this.membershipCache.set(cacheKey, {
      roles,
      expiresAt: Date.now() + AUTH_MEMBERSHIP_CACHE_TTL_MS,
    });

    return {
      sub: payload.sub,
      org_id: payload.org_id,
      roles,
    };
  }
}
