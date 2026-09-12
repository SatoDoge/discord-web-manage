import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import type {
  CreateScheduledMessageInput,
  ScheduledAttachmentFile,
  ScheduledMessage,
  ScheduledMessageList,
  UpdateScheduledMessageInput,
} from '#server/types/scheduledMessage.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const DATA_PATH = path.join(DATA_DIR, 'scheduledMessage.json');
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'scheduledAttachments');

const enqueue = createWriteQueue();

async function readFromDisk(): Promise<ScheduledMessageList> {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed) as ScheduledMessageList;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeToDisk([]);
      return [];
    }
    throw error;
  }
}

async function writeToDisk(list: ScheduledMessageList): Promise<void> {
  await writeFile(DATA_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

function findIndexOrThrow(list: ScheduledMessageList, id: string): number {
  const index = list.findIndex((message) => message.id === id);
  if (index === -1) {
    throw new Error(`Scheduled message not found: ${id}`);
  }
  return index;
}

function attachmentDir(id: string): string {
  return path.join(ATTACHMENTS_DIR, id);
}

function attachmentFilePath(id: string, index: number, filename: string): string {
  const safeName = filename.replace(/[^\w.\-()+\s]/g, '_') || 'attachment';
  return path.join(attachmentDir(id), `${String(index).padStart(3, '0')}_${safeName}`);
}

async function writeAttachmentFiles(
  id: string,
  files: ScheduledAttachmentFile[],
): Promise<ScheduledMessage['payload']['attachments']> {
  const dir = attachmentDir(id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const meta: ScheduledMessage['payload']['attachments'] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const filePath = attachmentFilePath(id, i, file.filename);
    await writeFile(filePath, file.data);
    meta.push({
      filename: file.filename,
      contentType: file.contentType,
      size: file.data.length,
    });
  }
  return meta;
}

async function removeAttachmentFiles(id: string): Promise<void> {
  await rm(attachmentDir(id), { recursive: true, force: true });
}

/** Load attachment binaries for a scheduled message (for Discord send). */
export async function loadScheduledAttachmentFiles(
  id: string,
  meta: ScheduledMessage['payload']['attachments'],
): Promise<MessageAttachmentInput[]> {
  const attachments: MessageAttachmentInput[] = [];
  for (let i = 0; i < meta.length; i += 1) {
    const item = meta[i];
    const filePath = attachmentFilePath(id, i, item.filename);
    const data = await readFile(filePath);
    attachments.push({
      filename: item.filename,
      data,
      contentType: item.contentType,
      size: data.length,
    });
  }
  return attachments;
}

/** Read all scheduled messages. */
export function getScheduledMessageList(): Promise<ScheduledMessageList> {
  return enqueue(() => readFromDisk());
}

/** Read a single scheduled message by id. */
export function getScheduledMessage(id: string): Promise<ScheduledMessage | undefined> {
  return enqueue(async () => {
    const list = await readFromDisk();
    return list.find((message) => message.id === id);
  });
}

/** Append a new scheduled message. */
export function addScheduledMessage(
  input: CreateScheduledMessageInput,
): Promise<ScheduledMessage> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const id = randomUUID();
    const now = new Date().toISOString();
    const attachmentFiles = input.attachmentFiles ?? [];
    const attachments =
      attachmentFiles.length > 0
        ? await writeAttachmentFiles(id, attachmentFiles)
        : (input.payload.attachments ?? []);

    const message: ScheduledMessage = {
      id,
      scheduledAt: input.scheduledAt,
      sentAt: null,
      success: null,
      payload: {
        content: input.payload.content,
        embeds: input.payload.embeds,
        threadName: input.payload.threadName,
        reason: input.payload.reason,
        attachments,
      },
      destination: {
        channelId: input.destination.channelId,
      },
      createdByUserId: input.createdByUserId,
      resultingMessageId: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };

    await writeToDisk([...list, message]);
    return message;
  });
}

/** Update fields on a pending (or reopened failed) scheduled message. */
export function updateScheduledMessage(
  id: string,
  patch: UpdateScheduledMessageInput,
): Promise<ScheduledMessage> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const index = findIndexOrThrow(list, id);
    const current = list[index];

    let attachments = current.payload.attachments;
    if (patch.attachmentFiles !== undefined) {
      if (patch.attachmentFiles.length > 0) {
        attachments = await writeAttachmentFiles(id, patch.attachmentFiles);
      } else {
        await removeAttachmentFiles(id);
        attachments = [];
      }
    }

    const reopenFailure = patch.reopenFailure === true;

    const next: ScheduledMessage = {
      ...current,
      scheduledAt: patch.scheduledAt ?? current.scheduledAt,
      sentAt: reopenFailure ? null : current.sentAt,
      success: reopenFailure ? null : current.success,
      error: reopenFailure ? null : current.error,
      resultingMessageId: reopenFailure ? null : current.resultingMessageId,
      destination: {
        channelId: patch.channelId ?? current.destination.channelId,
      },
      payload: {
        content: patch.content !== undefined ? patch.content : current.payload.content,
        embeds: patch.embeds ?? current.payload.embeds,
        threadName:
          patch.threadName !== undefined ? patch.threadName : current.payload.threadName,
        reason: patch.reason !== undefined ? patch.reason : current.payload.reason,
        attachments,
      },
      updatedAt: new Date().toISOString(),
    };

    const updated = [...list];
    updated[index] = next;
    await writeToDisk(updated);
    return next;
  });
}

/**
 * Reset a failed scheduled message back to pending so it can be force-sent.
 * Throws if the message is not in a failed state.
 */
export function reopenFailedScheduledMessage(id: string): Promise<ScheduledMessage> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const index = findIndexOrThrow(list, id);
    const current = list[index];
    if (current.success !== false) {
      throw new Error(`Scheduled message is not failed: ${id}`);
    }

    const next: ScheduledMessage = {
      ...current,
      sentAt: null,
      success: null,
      error: null,
      resultingMessageId: null,
      updatedAt: new Date().toISOString(),
    };

    const updated = [...list];
    updated[index] = next;
    await writeToDisk(updated);
    return next;
  });
}

/** Mark a scheduled message as successfully sent or failed. */
export function markScheduledMessageResult(
  id: string,
  result: {
    success: boolean;
    sentAt?: string;
    resultingMessageId?: string | null;
    error?: string | null;
  },
): Promise<ScheduledMessage> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const index = findIndexOrThrow(list, id);
    const current = list[index];
    const next: ScheduledMessage = {
      ...current,
      sentAt: result.sentAt ?? new Date().toISOString(),
      success: result.success,
      resultingMessageId:
        result.resultingMessageId !== undefined
          ? result.resultingMessageId
          : current.resultingMessageId,
      error: result.error !== undefined ? result.error : current.error,
      updatedAt: new Date().toISOString(),
    };
    const updated = [...list];
    updated[index] = next;
    await writeToDisk(updated);
    return next;
  });
}

/** Remove a scheduled message and its attachment files. */
export function removeScheduledMessage(id: string): Promise<boolean> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const next = list.filter((message) => message.id !== id);
    if (next.length === list.length) {
      return false;
    }
    await removeAttachmentFiles(id);
    await writeToDisk(next);
    return true;
  });
}
