import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  StoredMemberJoinEvent,
  StoredMemberJoinEventList,
} from '#server/types/memberJoinData.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/memberJoinData.json',
);

const MAX_STORED_JOIN_EVENTS = 100;

const enqueue = createWriteQueue();

async function readFromDisk(): Promise<StoredMemberJoinEventList> {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed) as StoredMemberJoinEventList;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeToDisk([]);
      return [];
    }
    throw error;
  }
}

async function writeToDisk(list: StoredMemberJoinEventList): Promise<void> {
  await writeFile(DATA_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

function findIndexOrThrow(
  list: StoredMemberJoinEventList,
  joinEventId: string,
): number {
  const index = list.findIndex((entry) => entry.joinEventId === joinEventId);
  if (index === -1) {
    throw new Error(`Member join event not found: ${joinEventId}`);
  }
  return index;
}

function appendWithLimit(
  list: StoredMemberJoinEventList,
  event: StoredMemberJoinEvent,
): StoredMemberJoinEventList {
  if (list.length >= MAX_STORED_JOIN_EVENTS) {
    return [...list.slice(1), event];
  }
  return [...list, event];
}

/** Read all stored member join events (most recent last, max 100). */
export function getMemberJoinEventList(): Promise<StoredMemberJoinEventList> {
  return enqueue(() => readFromDisk());
}

/** Read a single join event by id. */
export function getMemberJoinEvent(
  joinEventId: string,
): Promise<StoredMemberJoinEvent | undefined> {
  return enqueue(async () => {
    const list = await readFromDisk();
    return list.find((entry) => entry.joinEventId === joinEventId);
  });
}

/**
 * Append a join event. Keeps at most {@link MAX_STORED_JOIN_EVENTS} entries;
 * when full, the oldest entry is removed before inserting the new one.
 */
export function addMemberJoinEvent(
  event: StoredMemberJoinEvent,
): Promise<StoredMemberJoinEvent> {
  return enqueue(async () => {
    const list = await readFromDisk();
    if (list.some((existing) => existing.joinEventId === event.joinEventId)) {
      throw new Error(`Member join event already exists: ${event.joinEventId}`);
    }
    await writeToDisk(appendWithLimit(list, event));
    return event;
  });
}

/** Replace an existing join event. Throws if not found. */
export function updateMemberJoinEvent(
  event: StoredMemberJoinEvent,
): Promise<StoredMemberJoinEvent> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const index = findIndexOrThrow(list, event.joinEventId);
    const next = [...list];
    next[index] = event;
    await writeToDisk(next);
    return event;
  });
}
