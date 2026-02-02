import 'express';

declare global {
  namespace Express {
    interface Request {
      orgId?: string;
      user?: {
        id: string;
        roles?: string[];
      };
    }
  }
}