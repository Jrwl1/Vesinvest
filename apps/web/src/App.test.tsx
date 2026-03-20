import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_INVALIDATED_EVENT, clearToken } from './api';

describe('auth invalidation event', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('clears stored tokens and dispatches the auth invalidation event', () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_INVALIDATED_EVENT, listener);
    window.sessionStorage.setItem('access_token', 'session-token');
    window.localStorage.setItem('access_token', 'legacy-token');

    try {
      clearToken();

      expect(window.sessionStorage.getItem('access_token')).toBeNull();
      expect(window.localStorage.getItem('access_token')).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(AUTH_INVALIDATED_EVENT, listener);
    }
  });
});
