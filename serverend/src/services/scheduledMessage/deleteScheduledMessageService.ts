import {
  getScheduledMessage,
  removeScheduledMessage,
} from '#server/stores/scheduledMessageStore.js';
import { cancelScheduledMessageJob } from '#server/services/scheduledMessage/scheduledMessageScheduler.js';

export type DeleteScheduledMessageResult =
  | { ok: true; data: { id: string; deleted: true } }
  | { ok: false; status: number; error: 'not_found' };

/**
 * Delete a pending scheduled message and cancel its job.
 * Already-sent/failed records can also be removed from the store.
 */
export async function deleteScheduledMessage(
  id: string,
): Promise<DeleteScheduledMessageResult> {
  const existing = await getScheduledMessage(id);
  if (!existing) {
    return { ok: false, status: 404, error: 'not_found' };
  }

  cancelScheduledMessageJob(id);
  const removed = await removeScheduledMessage(id);
  if (!removed) {
    return { ok: false, status: 404, error: 'not_found' };
  }

  return { ok: true, data: { id, deleted: true } };
}
