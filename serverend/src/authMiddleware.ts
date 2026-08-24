import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { getSessionDataList } from '#server/stores/sessionDataStore.js';
import { Logger } from '#server/utils/logger.js';
export type AuthVariables = {
  userId: string;
  sessionId: string;
};
const logger = new Logger('Auth Middleware');
/**
 * Require a valid session cookie (`session_id`) backed by sessionDataStore.
 * Sets `userId` / `sessionId` on the context when authenticated.
 */
export const requireAuth = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
//   logger.info('Checking authentication');
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) {
    logger.info(`No session ID found in cookie`);
    return c.json({ error: 'unauthorized' }, 401);
  }
//   logger.info(`Session ID found in cookie: ${sessionId}`);
  const sessions = await getSessionDataList();
  const now = Date.now();
  const session = sessions.find(
    (entry) => entry.sessionId === sessionId && entry.expiresAt > now,
  );

  if (!session) {
    logger.info(`No session found for session ID: ${sessionId}`);
    return c.json({ error: 'unauthorized' }, 401);
  }
  logger.info(`Session found: ${session.userId}`);
  c.set('userId', session.userId);
  c.set('sessionId', session.sessionId);
  await next();
});
