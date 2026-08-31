import { Hono } from 'hono';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { fetchDupliFilterSettings } from '#server/services/filter/getDupliFilterSettingsService.js';
import { fetchMessageFilterSettings } from '#server/services/filter/getFilterSettingsService.js';
import { fetchModerationFilterSettings } from '#server/services/filter/getModerationFilterSettingsService.js';
import { fetchWordFilterSettings } from '#server/services/filter/getWordFilterSettingsService.js';
import { updateMessageFilterSettings } from '#server/services/filter/updateFilterSettingsService.js';
import { saveDupliFilterSettings } from '#server/services/filter/updateDupliFilterSettingsService.js';
import { saveModerationFilterSettings } from '#server/services/filter/updateModerationFilterSettingsService.js';
import { saveWordFilterSettings } from '#server/services/filter/updateWordFilterSettingsService.js';

const filter = new Hono<{ Variables: AuthVariables }>();

filter.use('*', requireAuth);

/** All message filter settings. */
filter.get('/', async (c) => c.json(await fetchMessageFilterSettings()));

/** Replace all message filter settings. */
filter.put('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await updateMessageFilterSettings(body);
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(result.data);
});

/** Word filter settings. */
filter.get('/word', async (c) => c.json(await fetchWordFilterSettings()));

filter.put('/word', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await saveWordFilterSettings(body);
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(result.data);
});

/** Duplicate message filter settings. */
filter.get('/dupli', async (c) => c.json(await fetchDupliFilterSettings()));

filter.put('/dupli', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await saveDupliFilterSettings(body);
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(result.data);
});

/** Moderation filter settings. */
filter.get('/moderation', async (c) => c.json(await fetchModerationFilterSettings()));

filter.put('/moderation', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await saveModerationFilterSettings(body);
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(result.data);
});

export default filter;
