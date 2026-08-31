import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { banStoredMessage } from '#server/services/message/banStoredMessageService.js';
import { deleteStoredMessage } from '#server/services/message/deleteStoredMessageService.js';
import { giveRoleStoredMessage } from '#server/services/message/giveRoleStoredMessageService.js';
import { fetchStoredMessage } from '#server/services/message/getMessageService.js';
import { fetchStoredMessageList } from '#server/services/message/getMessageListService.js';
import { kickStoredMessage } from '#server/services/message/kickStoredMessageService.js';
import { isSnowflake } from '#server/services/message/validation.js';

const message = new Hono<{ Variables: AuthVariables }>();

message.use('*', requireAuth);

function measureErrorStatus(error: string): ContentfulStatusCode {
  switch (error) {
    case 'message_not_found':
      return 404;
    case 'not_filtered':
      return 403;
    case 'invalid_reason':
    case 'invalid_role_id':
    case 'invalid_delete_message_seconds':
    case 'invalid_kick_seconds':
      return 400;
    case 'delete_failed':
    case 'ban_failed':
    case 'kick_failed':
    case 'role_failed':
      return 502;
    default:
      return 400;
  }
}

/** Stored messages from the local message DB (most recent last). */
message.get('/', async (c) => c.json(await fetchStoredMessageList()));

/** Single stored message by Discord message id. */
message.get('/:messageId', async (c) => {
  const messageId = c.req.param('messageId');
  if (!isSnowflake(messageId)) {
    return c.json({ error: 'invalid_message_id' }, 400);
  }

  const result = await fetchStoredMessage(messageId);
  if (!result.ok) {
    return c.json({ error: result.error }, 404);
  }

  return c.json(result.data);
});

/** Delete a filtered message on Discord and record the measure. */
message.post('/:messageId/delete', async (c) => {
  const messageId = c.req.param('messageId');
  if (!isSnowflake(messageId)) {
    return c.json({ error: 'invalid_message_id' }, 400);
  }

  const result = await deleteStoredMessage(messageId, c.get('userId'));
  if (!result.ok) {
    return c.json(
      {
        error: result.error,
        deleteError: result.deleteError,
      },
      measureErrorStatus(result.error),
    );
  }

  return c.json(result.data);
});

/** Ban the author of a filtered message and record the measure. */
message.post('/:messageId/ban', async (c) => {
  const messageId = c.req.param('messageId');
  if (!isSnowflake(messageId)) {
    return c.json({ error: 'invalid_message_id' }, 400);
  }

  let body: {
    reason?: unknown;
    deleteMessageSeconds?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await banStoredMessage({
    messageId,
    operationUserId: c.get('userId'),
    reason: body.reason,
    deleteMessageSeconds: body.deleteMessageSeconds,
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

/** Kick the author of a filtered message and record the measure. */
message.post('/:messageId/kick', async (c) => {
  const messageId = c.req.param('messageId');
  if (!isSnowflake(messageId)) {
    return c.json({ error: 'invalid_message_id' }, 400);
  }

  let body: {
    reason?: unknown;
    kickSeconds?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await kickStoredMessage({
    messageId,
    operationUserId: c.get('userId'),
    reason: body.reason,
    kickSeconds: body.kickSeconds,
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

/** Give a role to the author of a filtered message and record the measure. */
message.post('/:messageId/role', async (c) => {
  const messageId = c.req.param('messageId');
  if (!isSnowflake(messageId)) {
    return c.json({ error: 'invalid_message_id' }, 400);
  }

  let body: {
    roleId?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await giveRoleStoredMessage({
    messageId,
    operationUserId: c.get('userId'),
    roleId: body.roleId,
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

export default message;
