export abstract class BaseRepository {
  protected requireOrgId(orgId?: string): string {
    if (!orgId) {
      throw new Error('orgId is required for tenant-scoped operations');
    }
    return orgId;
  }
}