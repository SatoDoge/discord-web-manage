import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  BotPostedMessage,
  BotPostedMessageList,
  CreateBotPostedMessageInput,
} from '#server/types/botPostedMessage.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/botPostedMessage.json',
);

const MAX_STORED_MESSAGES = 500;

const enqueue = createWriteQueue();

async function readFromDisk(): Promise<BotPostedMessageList> {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed) as BotPostedMessageList;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeToDisk([]);
      return [];
    }
    throw error;
  }
}

async function writeToDisk(list: BotPostedMessageList): Promise<void> {
  await writeFile(DATA_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

function findIndexOrThrow(list: BotPostedMessageList, messageId: string): number {
  const index = list.findIndex((message) => message.messageId === messageId);
  if (index === -1) {
    throw new Error(`Bot posted message not found: ${messageId}`);
  }
  return index;
}

function appendWithLimit(
  list: BotPostedMessageList,
  message: BotPostedMessage,
): BotPostedMessageList {
  if (list.length >= MAX_STORED_MESSAGES) {
    return [...list.slice(1), message];
  }
  return [...list, message];
}

/** Read all bot-posted messages (most recent last, max 500). */
export function getBotPostedMessageList(): Promise<BotPostedMessageList> {
  return enqueue(() => readFromDisk());
}

/** Read a single bot-posted message by Discord message id. */
export function getBotPostedMessage(
  messageId: string,
): Promise<BotPostedMessage | undefined> {
  return enqueue(async () => {
    const list = await readFromDisk();
    return list.find((message) => message.messageId === messageId);
  });
}

/**
 * Append a bot-posted message record.
 * Throws if the message id already exists.
 */
export function addBotPostedMessage(
  input: CreateBotPostedMessageInput,
): Promise<BotPostedMessage> {
  return enqueue(async () => {
    const list = await readFromDisk();
    if (list.some((existing) => existing.messageId === input.messageId)) {
      throw new Error(`Bot posted message already exists: ${input.messageId}`);
    }

    const now = new Date().toISOString();
    const message: BotPostedMessage = {
      ...input,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      isDeleted: false,
    };

    await writeToDisk(appendWithLimit(list, message));
    return message;
  });
}

/** Replace fields on an existing bot-posted message record. */
export function updateBotPostedMessage(
  messageId: string,
  patch: Partial<
    Pick<
      BotPostedMessage,
      'content' | 'embeds' | 'attachments' | 'reason' | 'deletedAt' | 'isDeleted'
    >
  >,
): Promise<BotPostedMessage> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const index = findIndexOrThrow(list, messageId);
    const current = list[index];
    const next: BotPostedMessage = {
      ...current,
      ...patch,
      messageId: current.messageId,
      updatedAt: new Date().toISOString(),
    };
    const updated = [...list];
    updated[index] = next;
    await writeToDisk(updated);
    return next;
  });
}

/** Remove a bot-posted message record from the store. */
export function removeBotPostedMessage(messageId: string): Promise<boolean> {
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
