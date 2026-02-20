import 'express';

declare global {
  namespace Express {
    interface Request {
      orgId?: string;
      user?: {
        id?: string;
        sub?: string;
        org_id?: string;
        roles?: string[];
      };
    }
  }
}
