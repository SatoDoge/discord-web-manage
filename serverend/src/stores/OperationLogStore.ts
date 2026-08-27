import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OperationLog, OperationLogList } from '#server/types/operationLog.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/operationLog.json',
);

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

/** Read all operation logs (queued so it never interleaves with a write). */
export function getOperationLogList(): Promise<OperationLogList> {
  return enqueue(() => readFromDisk());
}

/** Append a new operation log entry. */
export function createOperationLog(log: OperationLog): Promise<OperationLog> {
  return enqueue(async () => {
    const list = await readFromDisk();
    await writeToDisk([...list, log]);
    return log;
  });
}
