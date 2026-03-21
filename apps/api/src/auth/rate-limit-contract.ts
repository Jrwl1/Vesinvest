export const AUTH_EDGE_RATE_LIMIT_HEADER = 'x-auth-rate-limit-verified';

export type AuthRateLimitMode = 'memory' | 'edge';

export function resolveAuthRateLimitMode(
  value = process.env.AUTH_RATE_LIMIT_MODE,
): AuthRateLimitMode {
  return value?.trim().toLowerCase() === 'edge' ? 'edge' : 'memory';
}
