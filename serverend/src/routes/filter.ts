import { Hono } from 'hono';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { fetchDupliFilterSettings } from '#server/services/filter/getDupliFilterSettingsService.js';
import { fetchMessageFilterSettings } from '#server/services/filter/getFilterSettingsService.js';
import { fetchJoinDelayFilterSettings } from '#server/services/filter/getJoinDelayFilterSettingsService.js';
import { fetchMemberProfileModerationFilterSettings } from '#server/services/filter/getMemberProfileModerationFilterSettingsService.js';
import { fetchModerationFilterSettings } from '#server/services/filter/getModerationFilterSettingsService.js';
import { fetchNameFilterSettings } from '#server/services/filter/getNameFilterSettingsService.js';
import { fetchWordFilterSettings } from '#server/services/filter/getWordFilterSettingsService.js';
import { updateMessageFilterSettings } from '#server/services/filter/updateFilterSettingsService.js';
import { saveDupliFilterSettings } from '#server/services/filter/updateDupliFilterSettingsService.js';
import { saveJoinDelayFilterSettings } from '#server/services/filter/updateJoinDelayFilterSettingsService.js';
import { saveMemberProfileModerationFilterSettings } from '#server/services/filter/updateMemberProfileModerationFilterSettingsService.js';
import { saveModerationFilterSettings } from '#server/services/filter/updateModerationFilterSettingsService.js';
import { saveNameFilterSettings } from '#server/services/filter/updateNameFilterSettingsService.js';
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

  const result = await updateMessageFilterSettings(body, {
    actorUserId: c.get('userId'),
  });
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

  const result = await saveWordFilterSettings(body, {
    actorUserId: c.get('userId'),
  });
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

  const result = await saveDupliFilterSettings(body, {
    actorUserId: c.get('userId'),
  });
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

  const result = await saveModerationFilterSettings(body, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(result.data);
});

/** Member name filter settings. */
filter.get('/member/name', async (c) => c.json(await fetchNameFilterSettings()));

filter.put('/member/name', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await saveNameFilterSettings(body, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(result.data);
});

/** Member join delay filter settings. */
filter.get('/member/join-delay', async (c) => c.json(await fetchJoinDelayFilterSettings()));

filter.put('/member/join-delay', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await saveJoinDelayFilterSettings(body, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(result.data);
});

/** Member profile moderation filter settings. */
filter.get('/member/profile-moderation', async (c) =>
  c.json(await fetchMemberProfileModerationFilterSettings()),
);

filter.put('/member/profile-moderation', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const result = await saveMemberProfileModerationFilterSettings(body, {
    actorUserId: c.get('userId'),
  });
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(result.data);
});

export default filter;
