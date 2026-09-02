import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  messageFilterDefaultSettings,
  type DupliFilterSettings,
  type MesssegFilterSettings,
  type ModerationFilterSettings,
  type WordFilterSettings,
} from '#server/types/messageFilterSettings.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/messageFilterSettings.json',
);

const enqueue = createWriteQueue();

function cloneDefaultSettings(): MesssegFilterSettings {
  return structuredClone(messageFilterDefaultSettings);
}

async function readFromDisk(): Promise<MesssegFilterSettings> {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      const defaults = cloneDefaultSettings();
      await writeToDisk(defaults);
      return defaults;
    }
    return JSON.parse(trimmed) as MesssegFilterSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const defaults = cloneDefaultSettings();
      await writeToDisk(defaults);
      return defaults;
    }
    throw error;
  }
}

async function writeToDisk(settings: MesssegFilterSettings): Promise<void> {
  await writeFile(DATA_PATH, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

/** Read all message filter settings. */
export function getMessageFilterSettings(): Promise<MesssegFilterSettings> {
  return enqueue(() => readFromDisk());
}

/** Replace all message filter settings. */
export function setMessageFilterSettings(
  settings: MesssegFilterSettings,
): Promise<MesssegFilterSettings> {
  return enqueue(async () => {
    await writeToDisk(settings);
    return settings;
  });
}

/** Read word filter settings. */
export async function getWordFilterSettings(): Promise<WordFilterSettings> {
  const settings = await getMessageFilterSettings();
  return settings.wordFilterSettings;
}

/** Replace word filter settings. */
export function updateWordFilterSettings(
  wordFilterSettings: WordFilterSettings,
): Promise<WordFilterSettings> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next: MesssegFilterSettings = {
      ...current,
      wordFilterSettings,
    };
    await writeToDisk(next);
    return wordFilterSettings;
  });
}

/** Read duplicate message filter settings. */
export async function getDupliFilterSettings(): Promise<DupliFilterSettings> {
  const settings = await getMessageFilterSettings();
  return settings.dupliFilterSettings;
}

/** Replace duplicate message filter settings. */
export function updateDupliFilterSettings(
  dupliFilterSettings: DupliFilterSettings,
): Promise<DupliFilterSettings> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next: MesssegFilterSettings = {
      ...current,
      dupliFilterSettings,
    };
    await writeToDisk(next);
    return dupliFilterSettings;
  });
}

/** Read moderation filter settings. */
export async function getModerationFilterSettings(): Promise<ModerationFilterSettings> {
  const settings = await getMessageFilterSettings();
  return settings.moderationFilterSettings;
}

/** Replace moderation filter settings. */
export function updateModerationFilterSettings(
  moderationFilterSettings: ModerationFilterSettings,
): Promise<ModerationFilterSettings> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next: MesssegFilterSettings = {
      ...current,
      moderationFilterSettings,
    };
    await writeToDisk(next);
    return moderationFilterSettings;
  });
}

/**
 * Atomically read → transform → write under the same queue slot.
 * Prefer this for mutations that depend on current contents.
 */
export function updateMessageFilterSettings(
  updater: (
    settings: MesssegFilterSettings,
  ) => MesssegFilterSettings | Promise<MesssegFilterSettings>,
): Promise<MesssegFilterSettings> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next = await updater(current);
    await writeToDisk(next);
    return next;
  });
}
