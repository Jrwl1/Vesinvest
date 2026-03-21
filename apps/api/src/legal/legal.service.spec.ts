import { LegalService } from './legal.service';

describe('LegalService', () => {
  const originalTermsVersion = process.env.LEGAL_TERMS_VERSION;
  const originalDpaVersion = process.env.LEGAL_DPA_VERSION;
  const originalTermsUrl = process.env.LEGAL_TERMS_URL;
  const originalDpaUrl = process.env.LEGAL_DPA_URL;

  beforeEach(() => {
    process.env.LEGAL_TERMS_VERSION = 'terms-v1';
    process.env.LEGAL_DPA_VERSION = 'dpa-v1';
    process.env.LEGAL_TERMS_URL = 'https://example.com/terms';
    process.env.LEGAL_DPA_URL = 'https://example.com/dpa';
  });

  afterEach(() => {
    process.env.LEGAL_TERMS_VERSION = originalTermsVersion;
    process.env.LEGAL_DPA_VERSION = originalDpaVersion;
    process.env.LEGAL_TERMS_URL = originalTermsUrl;
    process.env.LEGAL_DPA_URL = originalDpaUrl;
  });

  function createPrismaMock() {
    return {
      $transaction: jest.fn().mockResolvedValue([]),
      legalDocument: {
        updateMany: jest.fn().mockReturnValue({}),
        upsert: jest.fn().mockReturnValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      legalAcceptance: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
    } as any;
  }

  it('returns persisted current documents without syncing on read when active docs exist', async () => {
    const prisma = createPrismaMock();
    prisma.legalDocument.findMany.mockResolvedValue([
      {
        docType: 'terms',
        version: 'terms-v1',
        contentUrl: 'https://example.com/terms-live',
        isActive: true,
        publishedAt: new Date('2026-03-20T10:00:00.000Z'),
      },
      {
        docType: 'dpa',
        version: 'dpa-v1',
        contentUrl: 'https://example.com/dpa-live',
        isActive: true,
        publishedAt: new Date('2026-03-19T10:00:00.000Z'),
      },
    ]);

    const service = new LegalService(prisma);
    const result = await service.getCurrentDocuments();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toEqual({
      termsVersion: 'terms-v1',
      termsUrl: 'https://example.com/terms-live',
      dpaVersion: 'dpa-v1',
      dpaUrl: 'https://example.com/dpa-live',
      publishedAt: '2026-03-20T10:00:00.000Z',
    });
  });

  it('does not rewrite publishedAt during document sync updates', async () => {
    const prisma = createPrismaMock();
    prisma.legalDocument.findMany.mockResolvedValue([
      {
        docType: 'terms',
        version: 'terms-v1',
        contentUrl: 'https://example.com/terms',
        isActive: true,
        publishedAt: new Date('2026-03-20T10:00:00.000Z'),
      },
      {
        docType: 'dpa',
        version: 'dpa-v1',
        contentUrl: 'https://example.com/dpa',
        isActive: true,
        publishedAt: new Date('2026-03-20T10:00:00.000Z'),
      },
    ]);

    const service = new LegalService(prisma);
    await service.ensureCurrentDocuments();

    expect(prisma.legalDocument.upsert).toHaveBeenCalledTimes(2);
    for (const [args] of prisma.legalDocument.upsert.mock.calls) {
      expect(args.update.publishedAt).toBeUndefined();
      expect(args.create.publishedAt).toBeInstanceOf(Date);
    }
  });
});
