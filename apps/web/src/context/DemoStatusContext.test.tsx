import { describe, expect, it } from 'vitest';
import { resolveDemoEntryState } from './DemoStatusContext';

describe('resolveDemoEntryState', () => {
  it('returns loading while backend demo status is still pending', () => {
    expect(resolveDemoEntryState({ status: 'loading' })).toBe('loading');
  });

  it('returns unreachable when backend demo status cannot be fetched', () => {
    expect(resolveDemoEntryState({ status: 'unreachable' })).toBe(
      'unreachable',
    );
  });

  it('returns available only for internal demo mode with demo login enabled', () => {
    expect(
      resolveDemoEntryState({
        status: 'ready',
        enabled: true,
        appMode: 'internal_demo',
        authBypassEnabled: false,
        demoLoginEnabled: true,
        orgId: 'demo-org-1',
      }),
    ).toBe('available');
  });

  it('keeps non-demo trial mode unavailable even in non-production', () => {
    expect(
      resolveDemoEntryState({
        status: 'ready',
        enabled: false,
        appMode: 'trial',
        authBypassEnabled: false,
        demoLoginEnabled: false,
        orgId: null,
      }),
    ).toBe('unavailable');
  });

  it('keeps internal demo unavailable when demo login is disabled', () => {
    expect(
      resolveDemoEntryState({
        status: 'ready',
        enabled: true,
        appMode: 'internal_demo',
        authBypassEnabled: false,
        demoLoginEnabled: false,
        orgId: 'demo-org-1',
      }),
    ).toBe('unavailable');
  });
});
