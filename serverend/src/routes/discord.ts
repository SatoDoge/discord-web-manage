import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import {
  banMembers,
  isValidDeleteMessageSeconds,
} from '#server/services/discord/banMemberService.js';
import { deleteMessage } from '#server/services/discord/deleteMessageService.js';
import { fetchChannelList } from '#server/services/discord/getChannelListService.js';
import { fetchClientStatus } from '#server/services/discord/getClientStatusService.js';
import { fetchMemberList } from '#server/services/discord/getMemberListService.js';
import {
  fetchGlobalUserProfile,
  fetchGuildMemberProfile,
} from '#server/services/discord/getMemberProfileService.js';
import { fetchOnlineMemberList } from '#server/services/discord/getOnlineMember.js';
import { kickMembers } from '#server/services/discord/kickMemberService.js';
import { searchGuildMessages } from '#server/services/discord/searchMessageService.js';
import {
  applyPresenceUpdate,
  type PresenceUpdateInput,
} from '#server/services/discord/updateClientStatusService.js';
import type { MemberProfileError } from '#server/discord/getMemberProfile.js';

const discord = new Hono<{ Variables: AuthVariables }>();

discord.use('*', requireAuth);

/** Current Discord bot connection status, profile, and activities. */
discord.get('/status', async (c) => c.json(await fetchClientStatus()));

/** Update Discord bot presence status and/or activity. */
discord.put('/presence', async (c) => {
  let body: PresenceUpdateInput;
  try {
    body = await c.req.json<PresenceUpdateInput>();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = applyPresenceUpdate(body);
  if (!result.ok) {
    const status: ContentfulStatusCode =
      result.error === 'bot_not_connected' ? 503 : 400;
    return c.json({ error: result.error }, status);
  }

  return c.json({
    ok: true,
    status: await fetchClientStatus(),
  });
});

function profileErrorStatus(error: MemberProfileError): ContentfulStatusCode {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'guild_not_found':
    case 'user_not_found':
    case 'member_not_found':
      return 404;
    default:
      return 400;
  }
}

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function isSnowflakeArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((id) => typeof id === 'string' && isSnowflake(id));
}

/** Discord-wide user profile. */
discord.get('/users/:userId', async (c) => {
  const userId = c.req.param('userId');
  if (!isSnowflake(userId)) {
    return c.json({ error: 'invalid_user_id' }, 400);
  }

  const result = await fetchGlobalUserProfile(userId);
  if (!result.ok) {
    return c.json({ error: result.error }, profileErrorStatus(result.error));
  }

  return c.json(result.data);
});

/** All guild members from the local member store. */
discord.get('/members', async (c) => c.json(await fetchMemberList()));

/** Text channels in the configured guild (for search filters). */
discord.get('/channels', async (c) => {
  const result = await fetchChannelList();
  if (!result.ok) {
    const status: ContentfulStatusCode =
      result.error === 'bot_not_connected' || result.error === 'guild_not_configured' ? 503 : 404;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.data);
});

/** Guild members currently online (online, idle, or dnd) from the local member store. */
discord.get('/members/online', async (c) => c.json(await fetchOnlineMemberList()));

/** Ban one or more guild members. */
discord.post('/members/ban', async (c) => {
  let body: {
    userIds?: unknown;
    reason?: unknown;
    deleteMessageSeconds?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  if (!isSnowflakeArray(body.userIds)) {
    return c.json({ error: 'invalid_user_ids' }, 400);
  }
  if (typeof body.reason !== 'string' || !body.reason.trim()) {
    return c.json({ error: 'invalid_reason' }, 400);
  }

  const deleteMessageSeconds =
    body.deleteMessageSeconds === undefined ? 0 : body.deleteMessageSeconds;
  if (!isValidDeleteMessageSeconds(deleteMessageSeconds)) {
    return c.json({ error: 'invalid_delete_message_seconds' }, 400);
  }

  const result = await banMembers({
    userIds: body.userIds,
    reason: body.reason,
    deleteMessageSeconds,
  });

  return c.json(result);
});

/** Kick one or more guild members. */
discord.post('/members/kick', async (c) => {
  let body: {
    userIds?: unknown;
    reason?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  if (!isSnowflakeArray(body.userIds)) {
    return c.json({ error: 'invalid_user_ids' }, 400);
  }
  if (typeof body.reason !== 'string' || !body.reason.trim()) {
    return c.json({ error: 'invalid_reason' }, 400);
  }

  const result = await kickMembers({
    userIds: body.userIds,
    reason: body.reason,
  });

  return c.json(result);
});

/** Member profile in the current guild (`DISCORD_GUILD_ID`). */
discord.get('/members/:userId', async (c) => {
  const userId = c.req.param('userId');
  if (!isSnowflake(userId)) {
    return c.json({ error: 'invalid_user_id' }, 400);
  }

  const result = await fetchGuildMemberProfile(userId);
  if (!result.ok) {
    return c.json({ error: result.error }, profileErrorStatus(result.error));
  }

  return c.json(result.data);
});

/** Search guild messages (protected). Body matches searchMessageQuery. */
discord.post('/messages/search', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await searchGuildMessages(body);
  if (!result.ok) {
    const payload: { error: string; retry_after?: number } = {
      error: result.error,
    };
    if (result.retryAfter !== undefined) {
      payload.retry_after = result.retryAfter;
    }
    return c.json(payload, result.status as ContentfulStatusCode);
  }

  return c.json(result.data);
});

/** Delete a guild message by channel and message IDs. */
discord.post('/messages/delete', async (c) => {
  let body: {
    channelId?: unknown;
    messageId?: unknown;
    reason?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await deleteMessage(body.channelId, body.messageId, body.reason);
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.status as ContentfulStatusCode,
    );
  }

  return c.json({ ok: true });
});

export default discord;
