import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import {
  banMembers,
  isValidDeleteMessageSeconds,
} from '#server/services/discord/banMemberService.js';
import { deleteMessage } from '#server/services/discord/deleteMessageService.js';
import { fetchChannelList } from '#server/services/discord/getChannelListService.js';
import { fetchChannelDetail } from '#server/services/discord/getChannelDetailService.js';
import { fetchClientStatus } from '#server/services/discord/getClientStatusService.js';
import { fetchMemberList } from '#server/services/discord/getMemberListService.js';
import {
  fetchGlobalUserProfile,
  fetchGuildMemberProfile,
} from '#server/services/discord/getMemberProfileService.js';
import { fetchOnlineMemberList } from '#server/services/discord/getOnlineMember.js';
import { fetchRoleList, fetchRoleDetail } from '#server/services/discord/getRoleListService.js';
import { createRole } from '#server/services/discord/createRoleService.js';
import { updateRole } from '#server/services/discord/updateRoleService.js';
import { deleteRole } from '#server/services/discord/deleteRoleService.js';
import { fetchVoiceOccupancy } from '#server/services/discord/getVoiceOccupancyService.js';
import { applyVoiceMembersAction } from '#server/services/discord/voiceMembersActionService.js';
import { kickMembers } from '#server/services/discord/kickMemberService.js';
import { postChannelMessage } from '#server/services/discord/sendChannelMessageService.js';
import { postChannelMessageReply } from '#server/services/discord/replyChannelMessageService.js';
import { readMessagePostBody } from '#server/services/discord/readMessagePostBody.js';
import { searchGuildMessages } from '#server/services/discord/searchMessageService.js';
import {
  applyPresenceUpdate,
  type PresenceUpdateInput,
} from '#server/services/discord/updateClientStatusService.js';
import { updateChannel } from '#server/services/discord/updateChannelService.js';
import { createChannel } from '#server/services/discord/createChannelService.js';
import { createThread } from '#server/services/discord/createThreadService.js';
import { deleteChannel } from '#server/services/discord/deleteChannelService.js';
import {
  deleteChannelPermission,
  updateChannelPermission,
} from '#server/services/discord/updateChannelPermissionService.js';
import type { MemberProfileError } from '#server/discord/getMemberProfile.js';
import type { ChannelListScope } from '#server/discord/getChannelList.js';

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

  const result = applyPresenceUpdate(body, {
    actorUserId: c.get('userId'),
  });
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

/** Guild channels. `scope=manage` returns text/voice/category/forum for management UI. */
discord.get('/channels', async (c) => {
  const scopeParam = c.req.query('scope');
  const scope: ChannelListScope = scopeParam === 'manage' ? 'manage' : 'text';
  const result = await fetchChannelList(scope);
  if (!result.ok) {
    const status: ContentfulStatusCode =
      result.error === 'bot_not_connected' || result.error === 'guild_not_configured' ? 503 : 404;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.data);
});

/** Guild roles (for management UI and channel permission overwrite editing). */
discord.get('/roles', async (c) => {
  const result = await fetchRoleList();
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }
  return c.json(result.data);
});

/** Create a guild role. */
discord.post('/roles', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await createRole((body ?? {}) as Record<string, unknown>, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data, 201);
});

/** Detailed guild role info including permissions. */
discord.get('/roles/:roleId', async (c) => {
  const roleId = c.req.param('roleId');
  if (!isSnowflake(roleId)) {
    return c.json({ error: 'invalid_role_id' }, 400);
  }

  const result = await fetchRoleDetail(roleId);
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data);
});

/** Update guild role properties (name, color, hoist, mentionable, permissions, position). */
discord.patch('/roles/:roleId', async (c) => {
  const roleId = c.req.param('roleId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await updateRole(roleId, (body ?? {}) as Record<string, unknown>, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data);
});

/** Delete a guild role. */
discord.delete('/roles/:roleId', async (c) => {
  const roleId = c.req.param('roleId');

  let reason: unknown;
  try {
    const body = await c.req.json<{ reason?: unknown }>();
    reason = body.reason;
  } catch {
    reason = undefined;
  }

  const result = await deleteRole(roleId, reason, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json({ ok: true, role: result.data });
});

/** Voice/stage channels with currently connected members. */
discord.get('/voice/channels', async (c) => {
  const result = await fetchVoiceOccupancy();
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }
  return c.json(result.data);
});

/**
 * Apply a voice action to one or more members.
 * Actions: disconnect | move | mute | unmute | deaf | undeaf
 * `channelId` is required when action is `move`.
 */
discord.post('/voice/members/action', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await applyVoiceMembersAction((body ?? {}) as Record<string, unknown>, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result);
});

/**
 * Create a guild channel (text / voice / category / announcement / stage / forum).
 * Pass `parentId` to place it under a category (not allowed for category channels).
 */
discord.post('/channels', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await createChannel((body ?? {}) as Record<string, unknown>, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data, 201);
});

/** Detailed guild channel info including category and permission overwrites. */
discord.get('/channels/:channelId', async (c) => {
  const channelId = c.req.param('channelId');
  if (!isSnowflake(channelId)) {
    return c.json({ error: 'invalid_channel_id' }, 400);
  }

  const result = await fetchChannelDetail(channelId);
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data);
});

/**
 * Create a thread under a text/announcement channel, or a forum post under a forum channel.
 * Category is inherited from the parent channel (returned as categoryId / categoryName).
 */
discord.post('/channels/:channelId/threads', async (c) => {
  const channelId = c.req.param('channelId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await createThread(channelId, (body ?? {}) as Record<string, unknown>, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data, 201);
});

/** Update guild channel properties (name, topic, category, NSFW, slowmode, voice settings). */
discord.patch('/channels/:channelId', async (c) => {
  const channelId = c.req.param('channelId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await updateChannel(channelId, (body ?? {}) as Record<string, unknown>, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data);
});

/** Delete a guild channel. */
discord.delete('/channels/:channelId', async (c) => {
  const channelId = c.req.param('channelId');

  let reason: unknown;
  try {
    const body = await c.req.json<{ reason?: unknown }>();
    reason = body.reason;
  } catch {
    reason = undefined;
  }

  const result = await deleteChannel(channelId, reason, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json({ ok: true, channel: result.data });
});

/** Create or update a permission overwrite for a role or member on a channel. */
discord.put('/channels/:channelId/permissions/:overwriteId', async (c) => {
  const channelId = c.req.param('channelId');
  const overwriteId = c.req.param('overwriteId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await updateChannelPermission(
    channelId,
    overwriteId,
    (body ?? {}) as Record<string, unknown>,
    { actorUserId: c.get('userId') },
  );
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data);
});

/** Delete a permission overwrite from a channel. */
discord.delete('/channels/:channelId/permissions/:overwriteId', async (c) => {
  const channelId = c.req.param('channelId');
  const overwriteId = c.req.param('overwriteId');

  let reason: unknown;
  try {
    const body = await c.req.json<{ reason?: unknown }>();
    reason = body.reason;
  } catch {
    reason = undefined;
  }

  const result = await deleteChannelPermission(channelId, overwriteId, reason, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
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
    actorUserId: c.get('userId'),
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
    actorUserId: c.get('userId'),
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

/** Post a message and/or embeds to a text channel, thread, or forum channel. */
discord.post('/messages/send', async (c) => {
  const parsed = await readMessagePostBody(c);
  if (!parsed.ok) {
    return c.json(
      { error: parsed.error },
      parsed.status as ContentfulStatusCode,
    );
  }

  const result = await postChannelMessage(parsed.body, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.status as ContentfulStatusCode,
    );
  }

  return c.json(result.data);
});

/** Reply to a specific message in a text channel or thread. */
discord.post('/messages/reply', async (c) => {
  const parsed = await readMessagePostBody(c);
  if (!parsed.ok) {
    return c.json(
      { error: parsed.error },
      parsed.status as ContentfulStatusCode,
    );
  }

  const result = await postChannelMessageReply(parsed.body, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.status as ContentfulStatusCode,
    );
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

  const result = await deleteMessage(body.channelId, body.messageId, body.reason, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.status as ContentfulStatusCode,
    );
  }

  return c.json({ ok: true });
});

export default discord;
