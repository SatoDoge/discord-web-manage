import { dispatchScheduledMessage } from '#server/services/scheduledMessage/dispatchScheduledMessage.js';
import { cancelScheduledMessageJob } from '#server/services/scheduledMessage/scheduledMessageScheduler.js';
import {
  getScheduledMessage,
  reopenFailedScheduledMessage,
} from '#server/stores/scheduledMessageStore.js';
import type { ScheduledMessage } from '#server/types/scheduledMessage.js';

export type SendScheduledMessageNowResult =
  | { ok: true; data: ScheduledMessage }
  | { ok: false; status: number; error: string; data?: ScheduledMessage };

/**
 * Force-send a pending or failed scheduled message immediately.
 * Failed schedules are reopened as pending before dispatch.
 */
export async function sendScheduledMessageNow(
  id: string,
): Promise<SendScheduledMessageNowResult> {
  cancelScheduledMessageJob(id);

  const existing = await getScheduledMessage(id);
  if (!existing) {
    return { ok: false, status: 404, error: 'not_found' };
  }
  if (existing.success === true) {
    return { ok: false, status: 409, error: 'already_processed', data: existing };
  }

  if (existing.success === false) {
    await reopenFailedScheduledMessage(id);
  }

  return dispatchScheduledMessage(id);
}
