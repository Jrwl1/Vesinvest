import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CurrentLegalDocs {
  termsVersion: string;
  termsUrl: string | null;
  dpaVersion: string;
  dpaUrl: string | null;
  publishedAt: string;
}

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  private getConfiguredDocs(): CurrentLegalDocs {
    const termsVersion = process.env.LEGAL_TERMS_VERSION?.trim() || 'v1';
    const dpaVersion = process.env.LEGAL_DPA_VERSION?.trim() || 'v1';
    const termsUrl = process.env.LEGAL_TERMS_URL?.trim() || null;
    const dpaUrl = process.env.LEGAL_DPA_URL?.trim() || null;
    const publishedAt = new Date().toISOString();
    return { termsVersion, termsUrl, dpaVersion, dpaUrl, publishedAt };
  }

  async ensureCurrentDocuments(): Promise<CurrentLegalDocs> {
    const current = this.getConfiguredDocs();
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.legalDocument.updateMany({
        where: { docType: 'terms', version: { not: current.termsVersion } },
        data: { isActive: false },
      }),
      this.prisma.legalDocument.updateMany({
        where: { docType: 'dpa', version: { not: current.dpaVersion } },
        data: { isActive: false },
      }),
      this.prisma.legalDocument.upsert({
        where: {
          docType_version: {
            docType: 'terms',
            version: current.termsVersion,
          },
        },
        update: {
          isActive: true,
          contentUrl: current.termsUrl,
          publishedAt: now,
        },
        create: {
          docType: 'terms',
          version: current.termsVersion,
          contentUrl: current.termsUrl,
          isActive: true,
          publishedAt: now,
        },
      }),
      this.prisma.legalDocument.upsert({
        where: {
          docType_version: {
            docType: 'dpa',
            version: current.dpaVersion,
          },
        },
        update: {
          isActive: true,
          contentUrl: current.dpaUrl,
          publishedAt: now,
        },
        create: {
          docType: 'dpa',
          version: current.dpaVersion,
          contentUrl: current.dpaUrl,
          isActive: true,
          publishedAt: now,
        },
      }),
    ]);

    return current;
  }

  async getCurrentDocuments() {
    return this.ensureCurrentDocuments();
  }

  async hasUserAcceptedCurrent(orgId: string, userId: string): Promise<boolean> {
    const current = await this.ensureCurrentDocuments();
    const match = await this.prisma.legalAcceptance.findFirst({
      where: {
        orgId,
        userId,
        termsVersion: current.termsVersion,
        dpaVersion: current.dpaVersion,
      },
    });
    return Boolean(match);
  }

  async hasOrgAdminAcceptedCurrent(orgId: string): Promise<boolean> {
    const current = await this.ensureCurrentDocuments();
    const match = await this.prisma.legalAcceptance.findFirst({
      where: {
        orgId,
        termsVersion: current.termsVersion,
        dpaVersion: current.dpaVersion,
        user: {
          roles: {
            some: {
              org_id: orgId,
              role: { name: 'ADMIN' },
            },
          },
        },
      },
    });
    return Boolean(match);
  }

  async acceptCurrent(params: {
    orgId: string;
    userId: string;
    ip?: string;
    userAgent?: string;
  }) {
    const current = await this.ensureCurrentDocuments();
    const record = await this.prisma.legalAcceptance.upsert({
      where: {
        orgId_userId_termsVersion_dpaVersion: {
          orgId: params.orgId,
          userId: params.userId,
          termsVersion: current.termsVersion,
          dpaVersion: current.dpaVersion,
        },
      },
      update: {
        acceptedAt: new Date(),
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
      create: {
        orgId: params.orgId,
        userId: params.userId,
        termsVersion: current.termsVersion,
        dpaVersion: current.dpaVersion,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    });

    return {
      acceptedAt: record.acceptedAt.toISOString(),
      termsVersion: record.termsVersion,
      dpaVersion: record.dpaVersion,
    };
  }

  async getUserStatus(orgId: string, userId: string, roles: string[]) {
    const [requiresUserAcceptance, orgUnlocked] = await Promise.all([
      this.hasUserAcceptedCurrent(orgId, userId).then((ok) => !ok),
      this.hasOrgAdminAcceptedCurrent(orgId),
    ]);
    const isAdmin = roles.some((r) => r.toUpperCase() === 'ADMIN');
    return {
      requiresUserAcceptance,
      orgUnlocked,
      requiresOrgAdminAcceptance: !orgUnlocked && isAdmin,
      waitingForAdmin: !orgUnlocked && !isAdmin,
    };
  }
}

