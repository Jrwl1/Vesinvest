import { Injectable,UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppModeService } from '../app-mode/app-mode.service';
import { DEMO_ORG_ID } from '../demo/demo.constants';
import { LegalService } from '../legal/legal.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrialService } from '../trial/trial.service';
import { DemoService } from './demo.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly appModeService: AppModeService,
    private readonly legalService: LegalService,
    private readonly trialService: TrialService,
    private readonly demoService: DemoService,
  ) {}

  private resolveLoginOrgId(
    memberships: Array<{ orgId: string }>,
    requestedOrgId?: string,
  ): string {
    const uniqueOrgIds = [...new Set(memberships.map((m) => m.orgId))];
    if (uniqueOrgIds.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (requestedOrgId) {
      if (!uniqueOrgIds.includes(requestedOrgId)) {
        throw new UnauthorizedException('Invalid credentials');
      }
      return requestedOrgId;
    }

    if (uniqueOrgIds.length === 1) return uniqueOrgIds[0];

    if (this.appModeService.isInternalDemo() && uniqueOrgIds.includes(DEMO_ORG_ID)) {
      return DEMO_ORG_ID;
    }

    const nonDemoOrgIds = uniqueOrgIds.filter((id) => id !== DEMO_ORG_ID);
    if (nonDemoOrgIds.length === 1) return nonDemoOrgIds[0];

    throw new UnauthorizedException(
      'Multiple organizations for user. Provide orgId or use a single-tenant account.',
    );
  }

  async validateUser(email: string, password: string, requestedOrgId?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
      },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const orgId = this.resolveLoginOrgId(
      user.roles.map((ur) => ({ orgId: ur.org_id })),
      requestedOrgId,
    );

    const roles = user.roles
      .filter((ur) => ur.org_id === orgId)
      .map((ur) => ur.role.name);

    return { userId: user.id, orgId, roles };
  }

  async issueTokenForUser(
    userId: string,
    orgId: string,
    roles: string[],
    options?: { expiresIn?: string },
  ) {
    const payload = { sub: userId, org_id: orgId, roles };
    const accessToken = await this.jwt.signAsync(payload, options);

    return {
      accessToken,
      user: { userId, orgId, roles },
    };
  }

  async login(email: string, password: string, requestedOrgId?: string) {
    const { userId, orgId, roles } = await this.validateUser(email, password, requestedOrgId);
    if (this.appModeService.isTrial()) {
      await this.trialService.assertTrialAccessAllowed(orgId);
    }
    const auth = await this.issueTokenForUser(userId, orgId, roles);
    const legal = await this.legalService.getUserStatus(orgId, userId, roles);
    return { ...auth, legal };
  }

  // DEV-ONLY: bypass login for local development with long-lived token (7 days)
  async devToken() {
    const user = await this.prisma.user.findFirst({
      where: { email: 'admin@dev.local' },
      include: { roles: { include: { role: true } } },
    });

    if (!user || user.roles.length === 0) {
      throw new UnauthorizedException('Dev user or roles not found');
    }

    const orgId = user.roles[0].org_id;
    const roles = user.roles.map((ur) => ur.role.name);

    // Issue a 7-day token for dev convenience; normal login uses default 1h expiry
    return this.issueTokenForUser(user.id, orgId, roles, { expiresIn: '7d' });
  }

  async me(user?: { sub?: string; org_id?: string; roles?: string[] }) {
    const authUser = user ?? {};
    const legal = await this.legalService.getUserStatus(
      authUser.org_id ?? '',
      authUser.sub ?? '',
      authUser.roles ?? [],
    );
    return {
      userId: authUser.sub,
      orgId: authUser.org_id,
      roles: authUser.roles ?? [],
      legal,
    };
  }

  /**
   * Demo login: bootstrap demo data and issue token.
   * Idempotent - safe to call multiple times.
   * Token expires in 24h for security.
   */
  async demoLogin() {
    const { userId, orgId, roles } = await this.demoService.bootstrapDemo();
    const result = await this.issueTokenForUser(userId, orgId, roles, { expiresIn: '24h' });
    return {
      accessToken: result.accessToken,
      orgId,
    };
  }
}
