import { DemoResetService } from './demo-reset.service';

describe('DemoResetService', () => {
  const ORG_ID = 'org-1';

  const buildService = () => {
    const prisma = {
      ennuste: {
        findMany: jest.fn().mockResolvedValue([{ id: 'scenario-1' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      ennusteVuosi: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      talousarvio: {
        findMany: jest.fn().mockResolvedValue([{ id: 'budget-1' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      tuloajuri: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      talousarvioRivi: {
        deleteMany: jest.fn().mockResolvedValue({ count: 4 }),
      },
      talousarvioValisumma: {
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
      olettamus: {
        deleteMany: jest.fn().mockResolvedValue({ count: 6 }),
      },
      veetiSnapshot: {
        deleteMany: jest.fn().mockResolvedValue({ count: 7 }),
      },
      veetiOverride: {
        deleteMany: jest.fn().mockResolvedValue({ count: 8 }),
      },
      veetiYearPolicy: {
        deleteMany: jest.fn().mockResolvedValue({ count: 9 }),
      },
      veetiOrganisaatio: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      veetiBenchmark: {
        deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
      },
      invitation: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      legalAcceptance: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    const service = new DemoResetService(prisma);
    return { service, prisma };
  };

  it('deletes VEETI overrides and year policies during org reset', async () => {
    const { service, prisma } = buildService();

    const result = await service.resetOrgData(ORG_ID);

    expect(prisma.veetiOverride.deleteMany).toHaveBeenCalledWith({
      where: { orgId: ORG_ID },
    });
    expect(prisma.veetiYearPolicy.deleteMany).toHaveBeenCalledWith({
      where: { orgId: ORG_ID },
    });
    expect(result).toMatchObject({
      success: true,
      deleted: {
        veetiOverrides: 8,
        veetiYearPolicies: 9,
        veetiSnapshots: 7,
        veetiLink: 1,
      },
      recreated: {
        budget: false,
        assumptions: 0,
      },
    });
  });
});
