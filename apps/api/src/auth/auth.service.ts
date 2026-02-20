import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AppModeService } from '../app-mode/app-mode.service';
import { LegalService } from '../legal/legal.service';
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

  async validateUser(email: string, password: string, orgId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        roles: { some: { org_id: orgId } },
      },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const roles = user.roles.map((ur) => ur.role.name);

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

  async login(email: string, password: string, orgId: string) {
    if (this.appModeService.isTrial()) {
      await this.trialService.assertTrialAccessAllowed(orgId);
    }
    const { userId, roles } = await this.validateUser(email, password, orgId);
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

  async me(user: any) {
    const legal = await this.legalService.getUserStatus(user.org_id, user.sub, user.roles ?? []);
    return {
      userId: user.sub,
      orgId: user.org_id,
      roles: user.roles ?? [],
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
