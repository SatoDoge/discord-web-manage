import { randomUUID } from 'node:crypto';
import { updateAdminUserList } from '#server/stores/adminUserStore.js';
import { updateSessionDataList } from '#server/stores/sessionDataStore.js';
import type { AdminUser } from '#server/types/adminUser.js';
import { parseDurationMs } from '#server/utils/duration.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('auth.loginService');

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

export type LoginSuccess = {
  ok: true;
  sessionId: string;
  expiresAt: number;
  user: AdminUser;
};

export type LoginFailure = {
  ok: false;
  status: number;
  error: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function buildAvatarUrl(user: DiscordUser): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }
  const index = Number(BigInt(user.id) >> 22n) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function toAdminUser(user: DiscordUser): AdminUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.global_name ?? user.username,
    icon: buildAvatarUrl(user),
  };
}

async function exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams({
    client_id: requireEnv('CLIENT_ID'),
    client_secret: requireEnv('CLIENT_SECRET'),
    grant_type: 'authorization_code',
    code,
    redirect_uri: requireEnv('REDIRECT_URI'),
  });

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`token_exchange_failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as DiscordTokenResponse;
}

async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`user_fetch_failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as DiscordUser;
}

function isAdminUser(userId: string, adminList: AdminUser[]): boolean {
  const bootstrapAdminId = process.env.ADMIN_USER_ID?.trim();
  if (bootstrapAdminId && bootstrapAdminId === userId) {
    return true;
  }
  return adminList.some((admin) => admin.id === userId);
}

/**
 * Complete Discord OAuth2 login with an authorization code from the frontend redirect.
 */
export async function loginWithDiscordCode(
  code: string,
): Promise<LoginSuccess | LoginFailure> {
  if (!code.trim()) {
    return { ok: false, status: 400, error: 'missing_code' };
  }

  let discordUser: DiscordUser;
  try {
    const token = await exchangeCodeForToken(code);
    discordUser = await fetchDiscordUser(token.access_token);
  } catch (error) {
    console.error('[login]', error);
    return { ok: false, status: 401, error: 'oauth_failed' };
  }

  const profile = toAdminUser(discordUser);

  let allowed = false;
  await updateAdminUserList((list) => {
    allowed = isAdminUser(profile.id, list);
    if (!allowed) {
      return list;
    }

    const index = list.findIndex((admin) => admin.id === profile.id);
    if (index === -1) {
      return [...list, profile];
    }

    const next = [...list];
    next[index] = profile;
    return next;
  });

  if (!allowed) {
    logger.error(`login failed: not admin user: ${profile.id} ${profile.username}`);
    return { ok: false, status: 403, error: 'not_admin' };
  }

  const sessionTtlMs = parseDurationMs(process.env.SESSION_EXPIRES_IN ?? '14d');
  const sessionId = randomUUID();
  const expiresAt = Date.now() + sessionTtlMs;

  await updateSessionDataList((list) => {
    const now = Date.now();
    const active = list.filter(
      (session) => session.expiresAt > now && session.userId !== profile.id,
    );
    return [...active, { sessionId, userId: profile.id, expiresAt }];
  });

  logger.info(`login success: ${profile.id} ${profile.username}`);
  return {
    ok: true,
    sessionId,
    expiresAt,
    user: profile,
  };
}

export function buildDiscordAuthorizeUrl(): string {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', requireEnv('CLIENT_ID'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', requireEnv('REDIRECT_URI'));
  url.searchParams.set('scope', 'identify');
  return url.toString();
}
