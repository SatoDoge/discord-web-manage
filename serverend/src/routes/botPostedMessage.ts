import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { deleteStoredBotPostedMessage } from '#server/services/botPostedMessage/deleteBotPostedMessageService.js';
import { fetchBotPostedMessage } from '#server/services/botPostedMessage/getBotPostedMessageService.js';
import { fetchBotPostedMessageList } from '#server/services/botPostedMessage/getBotPostedMessageListService.js';
import { updateStoredBotPostedMessage } from '#server/services/botPostedMessage/updateBotPostedMessageService.js';
import { readBotMessageEditBody } from '#server/services/botPostedMessage/readBotMessageEditBody.js';

const botPostedMessage = new Hono<{ Variables: AuthVariables }>();

botPostedMessage.use('*', requireAuth);

/** All bot-posted messages recorded by this app (most recent first). */
botPostedMessage.get('/', async (c) => {
  const messages = await fetchBotPostedMessageList();
  return c.json({ messages });
});

/** Single bot-posted message by Discord message id. */
botPostedMessage.get('/:messageId', async (c) => {
  const result = await fetchBotPostedMessage(c.req.param('messageId'));
  if (!result.ok) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  return c.json(result.data);
});

/** Edit a bot-posted message on Discord and update the local record. */
botPostedMessage.patch('/:messageId', async (c) => {
  const parsed = await readBotMessageEditBody(c);
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, parsed.status as ContentfulStatusCode);
  }

  const result = await updateStoredBotPostedMessage(
    c.req.param('messageId'),
    parsed.body,
    { actorUserId: c.get('userId') },
  );
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.status as ContentfulStatusCode,
    );
  }

  return c.json(result.data);
});

/** Delete a bot-posted message on Discord and mark it deleted locally. */
botPostedMessage.delete('/:messageId', async (c) => {
  let body: { reason?: unknown } = {};
  try {
    const raw = await c.req.text();
    if (raw.trim()) {
      body = JSON.parse(raw);
    }
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await deleteStoredBotPostedMessage(
    c.req.param('messageId'),
    body.reason,
    { actorUserId: c.get('userId') },
  );
  if (!result.ok) {
    return c.json(
      { error: result.error },
      result.status as ContentfulStatusCode,
    );
  }

  return c.json(result.data);
});

export default botPostedMessage;
