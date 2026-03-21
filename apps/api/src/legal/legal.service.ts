import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CurrentLegalDocs {
  termsVersion: string;
  termsUrl: string | null;
  dpaVersion: string;
  dpaUrl: string | null;
  publishedAt: string;
}

const LEGAL_STATUS_CACHE_TTL_MS = 30_000;

@Injectable()
export class LegalService {
  private readonly userAcceptanceCache = new Map<
    string,
    { accepted: boolean; expiresAt: number }
  >();
  private readonly orgAcceptanceCache = new Map<
    string,
    { accepted: boolean; expiresAt: number }
  >();

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
    const current = this.getConfiguredDocs();
    const cacheKey = `${orgId}:${userId}:${current.termsVersion}:${current.dpaVersion}`;
    const cached = this.readCachedAcceptance(this.userAcceptanceCache, cacheKey);
    if (cached != null) {
      return cached;
    }
    const match = await this.prisma.legalAcceptance.findFirst({
      where: {
        orgId,
        userId,
        termsVersion: current.termsVersion,
        dpaVersion: current.dpaVersion,
      },
    });
    const accepted = Boolean(match);
    this.writeCachedAcceptance(this.userAcceptanceCache, cacheKey, accepted);
    return accepted;
  }

  async hasOrgAdminAcceptedCurrent(orgId: string): Promise<boolean> {
    const current = this.getConfiguredDocs();
    const cacheKey = `${orgId}:${current.termsVersion}:${current.dpaVersion}`;
    const cached = this.readCachedAcceptance(this.orgAcceptanceCache, cacheKey);
    if (cached != null) {
      return cached;
    }
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
    const accepted = Boolean(match);
    this.writeCachedAcceptance(this.orgAcceptanceCache, cacheKey, accepted);
    return accepted;
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

    const cacheSuffix = `${record.termsVersion}:${record.dpaVersion}`;
    this.userAcceptanceCache.delete(`${params.orgId}:${params.userId}:${cacheSuffix}`);
    this.orgAcceptanceCache.delete(`${params.orgId}:${cacheSuffix}`);

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

  private readCachedAcceptance(
    cache: Map<string, { accepted: boolean; expiresAt: number }>,
    key: string,
  ): boolean | null {
    const cached = cache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }
    return cached.accepted;
  }

  private writeCachedAcceptance(
    cache: Map<string, { accepted: boolean; expiresAt: number }>,
    key: string,
    accepted: boolean,
  ) {
    cache.set(key, {
      accepted,
      expiresAt: Date.now() + LEGAL_STATUS_CACHE_TTL_MS,
    });
  }
}
