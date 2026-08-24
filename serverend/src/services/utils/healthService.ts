/**
 * Utility endpoints (health checks, etc.).
 */
export function getHealth() {
  return {
    ok: true,
    service: 'serverend',
  } as const;
}
