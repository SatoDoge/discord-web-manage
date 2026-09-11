import { dispatchScheduledMessage } from '#server/services/scheduledMessage/dispatchScheduledMessage.js';
import { cancelScheduledMessageJob } from '#server/services/scheduledMessage/scheduledMessageScheduler.js';
import type { ScheduledMessage } from '#server/types/scheduledMessage.js';

export type SendScheduledMessageNowResult =
  | { ok: true; data: ScheduledMessage }
  | { ok: false; status: number; error: string; data?: ScheduledMessage };

/** Force-send a pending scheduled message immediately. */
export async function sendScheduledMessageNow(
  id: string,
): Promise<SendScheduledMessageNowResult> {
  cancelScheduledMessageJob(id);
  return dispatchScheduledMessage(id);
}
