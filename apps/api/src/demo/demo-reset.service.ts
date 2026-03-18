import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_ORG_ID, isDemoModeEnabled } from './demo.constants';

@Injectable()
export class DemoResetService {
  private readonly logger = new Logger(DemoResetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resetDemoData(): Promise<{
    success: boolean;
    deleted: {
      ennusteVuodet: number;
      ennusteet: number;
      tuloajurit: number;
      talousarvioRivit: number;
      talousarviotValisummat: number;
      talousarviot: number;
      olettamukset: number;
      veetiSnapshots: number;
      veetiOverrides: number;
      veetiYearPolicies: number;
      veetiLink: number;
      veetiBenchmarks: number;
      invitations: number;
      legalAcceptances: number;
    };
    recreated: {
      budget: boolean;
      assumptions: number;
    };
  }> {
    if (!isDemoModeEnabled()) {
      throw new ForbiddenException('Demo reset is only available in DEMO_MODE');
    }
    this.logger.warn('Starting demo data reset...');
    return this.resetOrgData(DEMO_ORG_ID);
  }

  async resetOrgData(orgId: string): Promise<{
    success: boolean;
    deleted: {
      ennusteVuodet: number;
      ennusteet: number;
      tuloajurit: number;
      talousarvioRivit: number;
      talousarviotValisummat: number;
      talousarviot: number;
      olettamukset: number;
      veetiSnapshots: number;
      veetiOverrides: number;
      veetiYearPolicies: number;
      veetiLink: number;
      veetiBenchmarks: number;
      invitations: number;
      legalAcceptances: number;
    };
    recreated: {
      budget: boolean;
      assumptions: number;
    };
  }> {
    const deleted = {
      ennusteVuodet: 0,
      ennusteet: 0,
      tuloajurit: 0,
      talousarvioRivit: 0,
      talousarviotValisummat: 0,
      talousarviot: 0,
      olettamukset: 0,
      veetiSnapshots: 0,
      veetiOverrides: 0,
      veetiYearPolicies: 0,
      veetiLink: 0,
      veetiBenchmarks: 0,
      invitations: 0,
      legalAcceptances: 0,
    };

    const ennusteet = await this.prisma.ennuste.findMany({
      where: { orgId },
      select: { id: true },
    });
    const ennusteIds = ennusteet.map((e) => e.id);

    if (ennusteIds.length > 0) {
      const vuodetResult = await this.prisma.ennusteVuosi.deleteMany({
        where: { ennusteId: { in: ennusteIds } },
      });
      deleted.ennusteVuodet = vuodetResult.count;
    }

    const ennusteetResult = await this.prisma.ennuste.deleteMany({ where: { orgId } });
    deleted.ennusteet = ennusteetResult.count;

    const talousarviot = await this.prisma.talousarvio.findMany({
      where: { orgId },
      select: { id: true },
    });
    const talousarvioIds = talousarviot.map((t) => t.id);

    if (talousarvioIds.length > 0) {
      const tuloajuritResult = await this.prisma.tuloajuri.deleteMany({
        where: { talousarvioId: { in: talousarvioIds } },
      });
      deleted.tuloajurit = tuloajuritResult.count;

      const rivitResult = await this.prisma.talousarvioRivi.deleteMany({
        where: { talousarvioId: { in: talousarvioIds } },
      });
      deleted.talousarvioRivit = rivitResult.count;

      const valisummatResult = await this.prisma.talousarvioValisumma.deleteMany({
        where: { talousarvioId: { in: talousarvioIds } },
      });
      deleted.talousarviotValisummat = valisummatResult.count;
    }

    const talousarviotResult = await this.prisma.talousarvio.deleteMany({ where: { orgId } });
    deleted.talousarviot = talousarviotResult.count;

    const olettamuksetResult = await this.prisma.olettamus.deleteMany({ where: { orgId } });
    deleted.olettamukset = olettamuksetResult.count;

    const snapshotsResult = await this.prisma.veetiSnapshot.deleteMany({ where: { orgId } });
    deleted.veetiSnapshots = snapshotsResult.count;

    const overridesResult = await this.prisma.veetiOverride.deleteMany({
      where: { orgId },
    });
    deleted.veetiOverrides = overridesResult.count;

    const yearPoliciesResult = await this.prisma.veetiYearPolicy.deleteMany({
      where: { orgId },
    });
    deleted.veetiYearPolicies = yearPoliciesResult.count;

    const linkResult = await this.prisma.veetiOrganisaatio.deleteMany({ where: { orgId } });
    deleted.veetiLink = linkResult.count;

    const benchmarkResult = await this.prisma.veetiBenchmark.deleteMany({});
    deleted.veetiBenchmarks = benchmarkResult.count;

    const inviteResult = await this.prisma.invitation.deleteMany({ where: { orgId } });
    deleted.invitations = inviteResult.count;

    const legalResult = await this.prisma.legalAcceptance.deleteMany({ where: { orgId } });
    deleted.legalAcceptances = legalResult.count;

    this.logger.warn(`Tenant data reset complete for org=${orgId} (empty org; no re-seed).`);

    return {
      success: true,
      deleted,
      recreated: {
        budget: false,
        assumptions: 0,
      },
    };
  }
}
