import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppModeService } from '../app-mode/app-mode.service';
import { DemoResetService } from '../demo/demo-reset.service';

@Injectable()
export class TrialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appModeService: AppModeService,
    private readonly demoResetService: DemoResetService,
  ) {}

  async getStatus(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        trialStartsAt: true,
        trialEndsAt: true,
        trialStatus: true,
        lockReason: true,
      },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const now = Date.now();
    const trialEndsAtMs = org.trialEndsAt?.getTime() ?? null;
    const expired = trialEndsAtMs !== null && trialEndsAtMs < now;
    const locked = org.trialStatus === 'locked' || expired || org.trialStatus === 'expired';
    const daysLeft =
      trialEndsAtMs === null ? null : Math.max(0, Math.ceil((trialEndsAtMs - now) / (1000 * 60 * 60 * 24)));

    return {
      appMode: this.appModeService.getMode(),
      trialStartsAt: org.trialStartsAt?.toISOString() ?? null,
      trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
      trialStatus: expired ? 'expired' : (org.trialStatus ?? 'active'),
      daysLeft,
      locked,
      lockReason: expired ? 'trial_expired' : (org.lockReason ?? null),
    };
  }

  async assertTrialAccessAllowed(orgId: string): Promise<void> {
    if (!this.appModeService.isTrial()) return;
    const status = await this.getStatus(orgId);
    if (status.locked) {
      throw new ForbiddenException(status.lockReason ?? 'Trial is locked');
    }
  }

  async resetData(orgId: string, roles: string[]) {
    if (!this.appModeService.isTrial()) {
      throw new ForbiddenException('Trial reset is only available in APP_MODE=trial');
    }
    const isAdmin = roles.some((r) => r.toUpperCase() === 'ADMIN');
    if (!isAdmin) throw new ForbiddenException('Only admins can reset trial data');

    const status = await this.getStatus(orgId);
    const allowAfterExpiry = process.env.TRIAL_ALLOW_RESET_AFTER_EXPIRY === 'true';
    if (status.locked && !allowAfterExpiry) {
      throw new ForbiddenException('Trial is locked; reset disabled');
    }
    return this.demoResetService.resetOrgData(orgId);
  }
}
