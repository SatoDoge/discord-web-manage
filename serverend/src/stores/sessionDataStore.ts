import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SessionDataList } from '#server/types/sessionData.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/sessionDataList.json',
);

const enqueue = createWriteQueue();

async function readFromDisk(): Promise<SessionDataList> {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed) as SessionDataList;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeToDisk([]);
      return [];
    }
    throw error;
  }
}

async function writeToDisk(list: SessionDataList): Promise<void> {
  await writeFile(DATA_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

/** Read sessions (queued so it never interleaves with a write). */
export function getSessionDataList(): Promise<SessionDataList> {
  return enqueue(() => readFromDisk());
}

/** Replace the entire session list. */
export function setSessionDataList(list: SessionDataList): Promise<void> {
  return enqueue(() => writeToDisk(list));
}

/**
 * Atomically read → transform → write under the same queue slot.
 * Prefer this for mutations that depend on current contents.
 */
export function updateSessionDataList(
  updater: (list: SessionDataList) => SessionDataList | Promise<SessionDataList>,
): Promise<SessionDataList> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next = await updater(current);
    await writeToDisk(next);
    return next;
  });
}
