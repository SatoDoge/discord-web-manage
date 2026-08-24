import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import {
  buildDiscordAuthorizeUrl,
  loginWithDiscordCode,
} from '#server/services/auth/loginService.js';

const auth = new Hono();

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

export default auth;
