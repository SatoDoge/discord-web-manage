import { getOperationLog } from '#server/stores/OperationLogStore.js';
import type { OperationLog } from '#server/types/operationLog.js';

export type GetOperationLogResult =
  | { ok: true; log: OperationLog }
  | { ok: false; error: 'invalid_log_id' | 'log_not_found' };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isLogId(value: string): boolean {
  return UUID_RE.test(value);
}

/** Return a single operation log by id. */
export async function fetchOperationLog(logId: string): Promise<GetOperationLogResult> {
  if (!isLogId(logId)) {
    return { ok: false, error: 'invalid_log_id' };
  }

  const log = await getOperationLog(logId);
  if (!log) {
    return { ok: false, error: 'log_not_found' };
  }

  return { ok: true, log };
}
