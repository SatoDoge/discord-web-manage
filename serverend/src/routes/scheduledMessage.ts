import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { createScheduledMessage } from '#server/services/scheduledMessage/createScheduledMessageService.js';
import { deleteScheduledMessage } from '#server/services/scheduledMessage/deleteScheduledMessageService.js';
import { fetchScheduledMessageList } from '#server/services/scheduledMessage/getScheduledMessageListService.js';
import { fetchScheduledMessage } from '#server/services/scheduledMessage/getScheduledMessageService.js';
import { readScheduledMessageBody } from '#server/services/scheduledMessage/readScheduledMessageBody.js';
import { sendScheduledMessageNow } from '#server/services/scheduledMessage/sendScheduledMessageNowService.js';
import { updatePendingScheduledMessage } from '#server/services/scheduledMessage/updateScheduledMessageService.js';

const scheduledMessage = new Hono<{ Variables: AuthVariables }>();

scheduledMessage.use('*', requireAuth);

/** List all scheduled messages (newest schedule first). */
scheduledMessage.get('/', async (c) => {
  const messages = await fetchScheduledMessageList();
  return c.json({ messages });
});

/** Create a scheduled message. */
scheduledMessage.post('/', async (c) => {
  const parsed = await readScheduledMessageBody(c);
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, parsed.status as ContentfulStatusCode);
  }

  const result = await createScheduledMessage(parsed.body, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data, 201);
});

/** Get a single scheduled message. */
scheduledMessage.get('/:id', async (c) => {
  const result = await fetchScheduledMessage(c.req.param('id'));
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }
  return c.json(result.data);
});

/** Update a pending or failed scheduled message (failed ones reopen as pending). */
scheduledMessage.patch('/:id', async (c) => {
  const parsed = await readScheduledMessageBody(c);
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, parsed.status as ContentfulStatusCode);
  }

  const result = await updatePendingScheduledMessage(c.req.param('id'), {
    ...parsed.body,
    replaceAttachments: parsed.body.replaceAttachments,
  });
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data);
});

/** Delete a scheduled message. */
scheduledMessage.delete('/:id', async (c) => {
  const result = await deleteScheduledMessage(c.req.param('id'));
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }
  return c.json(result.data);
});

/** Force-send a pending or failed scheduled message immediately. */
scheduledMessage.post('/:id/send-now', async (c) => {
  const result = await sendScheduledMessageNow(c.req.param('id'));
  if (!result.ok) {
    return c.json(
      { error: result.error, message: result.data ?? null },
      result.status as ContentfulStatusCode,
    );
  }
  return c.json(result.data);
});

export default scheduledMessage;
