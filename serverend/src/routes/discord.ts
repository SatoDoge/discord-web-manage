import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { fetchClientStatus } from '#server/services/discord/getClientStatusService.js';
import {
  fetchGlobalUserProfile,
  fetchGuildMemberProfile,
} from '#server/services/discord/getMemberProfileService.js';
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

export default discord;
