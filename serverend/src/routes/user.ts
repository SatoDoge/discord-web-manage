import { Hono } from 'hono';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { getAuthenticatedUserState } from '#server/services/user/stateService.js';

const user = new Hono<{ Variables: AuthVariables }>();

user.use('*', requireAuth);

/** Current authenticated admin profile (from adminUserList). */
user.get('/state', async (c) => {
  const userId = c.get('userId');
  const state = await getAuthenticatedUserState(userId);

  if (!state) {
    return c.json({ error: 'user_not_found' }, 404);
  }

  return c.json(state);
});

export default user;
