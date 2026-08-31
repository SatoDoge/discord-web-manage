import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CreateOperationLogInput,
  OperationLog,
  OperationLogList,
} from '#server/types/operationLog.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/operationLog.json',
);

const MAX_STORED_OPERATION_LOGS = 500;

const enqueue = createWriteQueue();

async function readFromDisk(): Promise<OperationLogList> {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed) as OperationLogList;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeToDisk([]);
      return [];
    }
    throw error;
  }
}

async function writeToDisk(list: OperationLogList): Promise<void> {
  await writeFile(DATA_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

function appendWithLimit(
  list: OperationLogList,
  log: OperationLog,
): OperationLogList {
  if (list.length >= MAX_STORED_OPERATION_LOGS) {
    return [...list.slice(1), log];
  }
  return [...list, log];
}

/** Read all operation logs (most recent last, max 500). */
export function getOperationLogList(): Promise<OperationLogList> {
  return enqueue(() => readFromDisk());
}

/** Read a single operation log by id. */
export function getOperationLog(logId: string): Promise<OperationLog | undefined> {
  return enqueue(async () => {
    const list = await readFromDisk();
    return list.find((entry) => entry.logId === logId);
  });
}

/** Append a new operation log entry. */
export function addOperationLog(
  input: CreateOperationLogInput,
): Promise<OperationLog> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const log: OperationLog = {
      ...input,
      logId: randomUUID(),
      occurredAt: new Date().toISOString(),
    };
    await writeToDisk(appendWithLimit(list, log));
    return log;
  });
}
