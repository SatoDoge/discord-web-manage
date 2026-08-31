import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { banStoredMemberJoin } from '#server/services/memberJoin/banStoredMemberJoinService.js';
import { giveRoleStoredMemberJoin } from '#server/services/memberJoin/giveRoleStoredMemberJoinService.js';
import { fetchStoredMemberJoinEvent } from '#server/services/memberJoin/getMemberJoinEventService.js';
import { fetchStoredMemberJoinEventList } from '#server/services/memberJoin/getMemberJoinEventListService.js';
import { kickStoredMemberJoin } from '#server/services/memberJoin/kickStoredMemberJoinService.js';

const memberJoin = new Hono<{ Variables: AuthVariables }>();

memberJoin.use('*', requireAuth);

function measureErrorStatus(error: string): ContentfulStatusCode {
  switch (error) {
    case 'join_event_not_found':
      return 404;
    case 'not_filtered':
      return 403;
    case 'invalid_reason':
    case 'invalid_role_id':
      return 400;
    case 'ban_failed':
    case 'kick_failed':
    case 'role_failed':
      return 502;
    default:
      return 400;
  }
}

/** Stored member join events (most recent last). */
memberJoin.get('/', async (c) => c.json(await fetchStoredMemberJoinEventList()));

/** Single stored join event by id. */
memberJoin.get('/:joinEventId', async (c) => {
  const joinEventId = decodeURIComponent(c.req.param('joinEventId'));
  const result = await fetchStoredMemberJoinEvent(joinEventId);
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }

  return c.json(result.data);
});

/** Ban the user from a filtered join event and record the measure. */
memberJoin.post('/:joinEventId/ban', async (c) => {
  const joinEventId = decodeURIComponent(c.req.param('joinEventId'));
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const payload = body as { reason?: unknown };
  const result = await banStoredMemberJoin({
    joinEventId,
    operationUserId: c.get('userId'),
    reason: payload.reason,
  });

  if (!result.ok) {
    return c.json(
      {
        error: result.error,
        banError: result.banError,
      },
      measureErrorStatus(result.error),
    );
  }

  return c.json(result.data);
});

/** Kick the user from a filtered join event and record the measure. */
memberJoin.post('/:joinEventId/kick', async (c) => {
  const joinEventId = decodeURIComponent(c.req.param('joinEventId'));
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const payload = body as { reason?: unknown };
  const result = await kickStoredMemberJoin({
    joinEventId,
    operationUserId: c.get('userId'),
    reason: payload.reason,
  });

  if (!result.ok) {
    return c.json(
      {
        error: result.error,
        kickError: result.kickError,
      },
      measureErrorStatus(result.error),
    );
  }

  return c.json(result.data);
});

/** Give a role to the user from a filtered join event and record the measure. */
memberJoin.post('/:joinEventId/role', async (c) => {
  const joinEventId = decodeURIComponent(c.req.param('joinEventId'));
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const payload = body as { roleId?: unknown };
  const result = await giveRoleStoredMemberJoin({
    joinEventId,
    operationUserId: c.get('userId'),
    roleId: payload.roleId,
  });

  if (!result.ok) {
    return c.json(
      {
        error: result.error,
        roleError: result.roleError,
      },
      measureErrorStatus(result.error),
    );
  }

  return c.json(result.data);
});

export default memberJoin;
