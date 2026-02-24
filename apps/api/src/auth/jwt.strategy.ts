import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub?: string;
  org_id?: string;
  roles?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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

    return {
      sub: payload.sub,
      org_id: payload.org_id,
      roles: memberships.map((membership) => membership.role.name),
    };
  }
}
