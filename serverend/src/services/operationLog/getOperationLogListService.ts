import { getOperationLogList } from '#server/stores/OperationLogStore.js';
import type { OperationLogList } from '#server/types/operationLog.js';

/** Return operation logs with the most recent entries first. */
export async function fetchOperationLogList(): Promise<OperationLogList> {
  const list = await getOperationLogList();
  return [...list].reverse();
}
