import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  StoredGuildMessage,
  StoredGuildMessageList,
} from '#server/types/messageData.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/messageData.json',
);

const MAX_STORED_MESSAGES = 100;

const enqueue = createWriteQueue();

async function readFromDisk(): Promise<StoredGuildMessageList> {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed) as StoredGuildMessageList;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeToDisk([]);
      return [];
    }
    throw error;
  }
}

async function writeToDisk(list: StoredGuildMessageList): Promise<void> {
  await writeFile(DATA_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

function findIndexOrThrow(list: StoredGuildMessageList, messageId: string): number {
  const index = list.findIndex((message) => message.messageId === messageId);
  if (index === -1) {
    throw new Error(`Message not found: ${messageId}`);
  }
  return index;
}

function appendWithLimit(
  list: StoredGuildMessageList,
  message: StoredGuildMessage,
): StoredGuildMessageList {
  if (list.length >= MAX_STORED_MESSAGES) {
    return [...list.slice(1), message];
  }
  return [...list, message];
}

/** Read all stored messages (most recent last, max 100). */
export function getMessageList(): Promise<StoredGuildMessageList> {
  return enqueue(() => readFromDisk());
}

/** Read a single message by Discord message id. */
export function getMessage(messageId: string): Promise<StoredGuildMessage | undefined> {
  return enqueue(async () => {
    const list = await readFromDisk();
    return list.find((message) => message.messageId === messageId);
  });
}

/**
 * Append a message. Keeps at most {@link MAX_STORED_MESSAGES} entries;
 * when full, the oldest entry is removed before inserting the new one.
 * Throws if the message id already exists.
 */
export function addMessage(message: StoredGuildMessage): Promise<StoredGuildMessage> {
  return enqueue(async () => {
    const list = await readFromDisk();
    if (list.some((existing) => existing.messageId === message.messageId)) {
      throw new Error(`Message already exists: ${message.messageId}`);
    }
    await writeToDisk(appendWithLimit(list, message));
    return message;
  });
}

/**
 * Replace an existing message by messageId.
 * Throws if the message does not exist.
 */
export function updateMessage(message: StoredGuildMessage): Promise<StoredGuildMessage> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const index = findIndexOrThrow(list, message.messageId);
    const next = [...list];
    next[index] = message;
    await writeToDisk(next);
    return message;
  });
}

/** Remove a message by id. Returns true if removed, false if not found. */
export function removeMessage(messageId: string): Promise<boolean> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const next = list.filter((message) => message.messageId !== messageId);
    if (next.length === list.length) {
      return false;
    }
    await writeToDisk(next);
    return true;
  });
}

/**
 * Atomically read → transform → write under the same queue slot.
 * Prefer this for mutations that depend on current contents.
 */
export function updateMessageList(
  updater: (
    list: StoredGuildMessageList,
  ) => StoredGuildMessageList | Promise<StoredGuildMessageList>,
): Promise<StoredGuildMessageList> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next = await updater(current);
    await writeToDisk(next);
    return next;
  });
}
