import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { addAdminUser } from '#server/services/auth/addAdminUser.js';
import { getAdminUser, getAdminUsers } from '#server/services/auth/getAdminUser.js';
import {
  buildDiscordAuthorizeUrl,
  loginWithDiscordCode,
} from '#server/services/auth/loginService.js';
import { removeAdminUser } from '#server/services/auth/removeAdminUser.js';

const auth = new Hono<{ Variables: AuthVariables }>();

/** Redirect the browser to Discord's OAuth2 authorize screen. */
auth.get('/discord', (c) => {
  try {
    return c.redirect(buildDiscordAuthorizeUrl());
  } catch (error) {
    console.error('[auth/discord]', error);
    return c.json({ error: 'oauth_not_configured' }, 500);
  }
});

/** Exchange OAuth code for a session (called from /auth/redirect). */
auth.post('/login', async (c) => {
  let code: unknown;
  try {
    const body = await c.req.json<{ code?: unknown }>();
    code = body.code;
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  if (typeof code !== 'string') {
    return c.json({ error: 'missing_code' }, 400);
  }

  const result = await loginWithDiscordCode(code);
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.status as ContentfulStatusCode,
    );
  }

  const maxAge = Math.max(1, Math.floor((result.expiresAt - Date.now()) / 1000));
  setCookie(c, 'session_id', result.sessionId, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    maxAge,
  });

  return c.json({
    ok: true,
    user: result.user,
  });
});

/** List all admin users (protected). */
auth.get('/admin-users', requireAuth, async (c) => {
  const users = await getAdminUsers();
  return c.json({ users });
});

/** Get a single admin user (protected). */
auth.get('/admin-users/:userId', requireAuth, async (c) => {
  const result = await getAdminUser(c.req.param('userId'));
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.status as ContentfulStatusCode,
    );
  }

  return c.json(result.user);
});

/** Add a new admin user from memberStore (protected). */
auth.post('/admin-users', requireAuth, async (c) => {
  let userId: unknown;
  try {
    const body = await c.req.json<{ userId?: unknown }>();
    userId = body.userId;
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  if (typeof userId !== 'string') {
    return c.json({ error: 'missing_user_id' }, 400);
  }

  const result = await addAdminUser(userId);
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.status as ContentfulStatusCode,
    );
  }

  return c.json({
    ok: true,
    user: result.user,
  });
});

/** Remove an admin user (protected). */
auth.delete('/admin-users/:userId', requireAuth, async (c) => {
  const result = await removeAdminUser(c.req.param('userId'));
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.status as ContentfulStatusCode,
    );
  }

  return c.json({
    ok: true,
    user: result.user,
  });
});

export default auth;
