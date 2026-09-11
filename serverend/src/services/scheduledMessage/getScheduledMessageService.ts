import { getScheduledMessage } from '#server/stores/scheduledMessageStore.js';
import type { ScheduledMessage } from '#server/types/scheduledMessage.js';

export type GetScheduledMessageResult =
  | { ok: true; data: ScheduledMessage }
  | { ok: false; status: number; error: 'not_found' };

/** Fetch a single scheduled message by id. */
export async function fetchScheduledMessage(
  id: string,
): Promise<GetScheduledMessageResult> {
  const message = await getScheduledMessage(id);
  if (!message) {
    return { ok: false, status: 404, error: 'not_found' };
  }
  return { ok: true, data: message };
}
