import { api,dedupeInFlightGet } from './core';

export async function getLegalCurrent(): Promise<{
  termsVersion: string;
  termsUrl: string | null;
  dpaVersion: string;
  dpaUrl: string | null;
  publishedAt: string;
}> {
  return api('/legal/current', { method: 'GET' });
}

export async function getLegalStatus(): Promise<{
  requiresUserAcceptance: boolean;
  orgUnlocked: boolean;
  requiresOrgAdminAcceptance: boolean;
  waitingForAdmin: boolean;
}> {
  return dedupeInFlightGet('GET /legal/status', () =>
    api('/legal/status', { method: 'GET' }),
  );
}

export async function acceptLegal(): Promise<{
  acceptedAt: string;
  termsVersion: string;
  dpaVersion: string;
  requiresUserAcceptance: boolean;
  orgUnlocked: boolean;
  requiresOrgAdminAcceptance: boolean;
  waitingForAdmin: boolean;
}> {
  return api('/legal/accept', {
    method: 'POST',
    body: JSON.stringify({ acceptTerms: true, acceptDpa: true }),
  });
}
