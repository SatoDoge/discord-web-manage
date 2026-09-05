import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { getAdminUserList } from '#server/stores/adminUserStore.js';
import { getSessionDataList } from '#server/stores/sessionDataStore.js';
import { Logger } from '#server/utils/logger.js';
export type AuthVariables = {
  userId: string;
  sessionId: string;
};
const logger = new Logger('Auth Middleware');
/**
 * Require a valid session cookie (`session_id`) for a registered admin user.
 * Sets `userId` / `sessionId` on the context when authenticated.
 */
export const requireAuth = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) {
    logger.info(`No session ID found in cookie`);
    return c.json({ error: 'unauthorized' }, 401);
  }

  const sessions = await getSessionDataList();
  const now = Date.now();
  const session = sessions.find(
    (entry) => entry.sessionId === sessionId && entry.expiresAt > now,
  );

  if (!session) {
    logger.info(`No session found for session ID: ${sessionId}`);
    return c.json({ error: 'unauthorized' }, 401);
  }

  const admins = await getAdminUserList();
  const isAdmin = admins.some((admin) => admin.id === session.userId);
  if (!isAdmin) {
    logger.info(`Session user is not a registered admin: ${session.userId}`);
    return c.json({ error: 'unauthorized' }, 401);
  }

  logger.info(`Session found: ${session.userId}`);
  c.set('userId', session.userId);
  c.set('sessionId', session.sessionId);
  await next();
});
