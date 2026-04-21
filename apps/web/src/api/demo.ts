import type { DemoResetResult } from '../types';
import { API_BASE,IS_DEV,api,dedupeInFlightGet,setToken,type AppMode } from './core';

export type DemoStatusResult =
  | {
      enabled: boolean;
      appMode: AppMode;
      authBypassEnabled: boolean;
      demoLoginEnabled: boolean;
      orgId?: string | null;
    }
  | { unreachable: true };

/**
 * Fetch demo status from backend. GET /demo/status, no auth, never throws.
 * Use this on app bootstrap and store in context; never infer demo mode from env alone.
 * Handles 304 (empty body) so we don't misclassify as "backend not responding".
 * In dev, retries a few times with delay so cold "pnpm dev" doesn't show red banner before API is up.
 */
export async function getDemoStatus(): Promise<DemoStatusResult> {
  return dedupeInFlightGet('GET /demo/status', async () => {
    const maxAttempts = IS_DEV ? 5 : 1;
    const delayMs = IS_DEV ? 1200 : 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/demo/status`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return { unreachable: true };
        const text = await res.text();
        if (!text.trim()) {
          return {
            enabled: false,
            appMode: 'trial',
            authBypassEnabled: false,
            demoLoginEnabled: false,
            orgId: null,
          };
        }
        let data: {
          enabled?: boolean;
          orgId?: string | null;
          appMode?: AppMode;
          authBypassEnabled?: boolean;
          demoLoginEnabled?: boolean;
        } = {};
        try {
          data = JSON.parse(text);
        } catch {
          return {
            enabled: false,
            appMode: 'trial',
            authBypassEnabled: false,
            demoLoginEnabled: false,
            orgId: null,
          };
        }
        const enabled = data?.enabled === true;
        return {
          enabled,
          appMode: data.appMode ?? 'trial',
          authBypassEnabled: data.authBypassEnabled === true,
          demoLoginEnabled: data.demoLoginEnabled === true,
          orgId: enabled
            ? data?.orgId ?? 'demo-org-00000000-0000-0000-0000-000000000001'
            : null,
        };
      } catch {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        return { unreachable: true };
      }
    }
    return { unreachable: true };
  });
}

/**
 * Demo login: calls /auth/demo-login which issues a demo token when the API is in internal demo mode.
 * Preferred backend switch: APP_MODE=internal_demo. Legacy fallback: DEMO_MODE=true when APP_MODE is unset.
 * Demo gating is backend-owned; the browser does not ship a shared secret.
 */
export async function demoLogin(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/demo-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Demo login endpoint missing on backend (/auth/demo-login).',
      );
    }
    if (res.status === 429) {
      throw new Error('Demo rate limit exceeded');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Demo login rejected by server (check APP_MODE/DEMO_MODE).',
      );
    }
    throw new Error(`Demo login failed (${res.status})`);
  }

  const data = await res.json();
  const token = data.accessToken;
  setToken(token);
  console.log('demo-login OK');
  return token;
}

export interface TrialStatusDto {
  appMode: AppMode;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  trialStatus: 'active' | 'expired' | 'locked';
  daysLeft: number | null;
  locked: boolean;
  lockReason: string | null;
}

export async function getTrialStatus(): Promise<TrialStatusDto> {
  return api('/trial/status', { method: 'GET' });
}

export async function resetTrialData(): Promise<DemoResetResult> {
  return api('/trial/reset-data', { method: 'POST' });
}

// ============ Demo Mode API ============

/**
 * Reset all demo data to a clean state.
 * Only works when the backend reports internal demo mode.
 */
export async function resetDemoData(): Promise<DemoResetResult> {
  return api<DemoResetResult>('/demo/reset', { method: 'POST' });
}

/**
 * Result of POST /demo/seed. Only available when demo mode is enabled (404 otherwise).
 */
export interface DemoSeedResult {
  alreadySeeded: boolean;
  seededAt: string;
  /** When a 3-year set was created (or already existed), use this to load the set and show 3 cards. */
  batchId?: string;
  created?: { assumptions: number; budget: boolean; projection: boolean };
}

/**
 * Seed optional demo dataset (budget, assumptions, projection). Idempotent.
 * Only available when demo mode is enabled; returns 404 in production.
 */
export async function seedDemoData(): Promise<DemoSeedResult> {
  return api<DemoSeedResult>('/demo/seed', { method: 'POST' });
}

// ============ Vesipolku Budget API ============

/**
 * Subtotal line from KVA import (TalousarvioValisumma). Used for section totals when rivit are empty.
 * categoryKey and tyyppi align with GET /budgets/:id and KVA confirm payload (deterministic readback).
 */