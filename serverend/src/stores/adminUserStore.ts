import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AdminUserList } from '#server/types/adminUser.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/adminUserList.json',
);

const enqueue = createWriteQueue();

async function readFromDisk(): Promise<AdminUserList> {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed) as AdminUserList;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeToDisk([]);
      return [];
    }
    throw error;
  }
}

async function writeToDisk(list: AdminUserList): Promise<void> {
  await writeFile(DATA_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

/** Read admin users (queued so it never interleaves with a write). */
export function getAdminUserList(): Promise<AdminUserList> {
  return enqueue(() => readFromDisk());
}

/** Replace the entire admin user list. */
export function setAdminUserList(list: AdminUserList): Promise<void> {
  return enqueue(() => writeToDisk(list));
}

/**
 * Atomically read → transform → write under the same queue slot.
 * Prefer this for mutations that depend on current contents.
 */
export function updateAdminUserList(
  updater: (list: AdminUserList) => AdminUserList | Promise<AdminUserList>,
): Promise<AdminUserList> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next = await updater(current);
    await writeToDisk(next);
    return next;
  });
}
