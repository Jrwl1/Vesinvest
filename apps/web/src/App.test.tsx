import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_INVALIDATED_EVENT, clearToken, demoLogin } from './api';

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

  it('posts demo login without a browser-shipped demo secret', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ accessToken: 'demo-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(demoLogin()).resolves.toBe('demo-token');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/auth\/demo-login$/),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
      expect(window.sessionStorage.getItem('access_token')).toBe('demo-token');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
