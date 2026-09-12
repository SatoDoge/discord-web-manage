import { getScheduledMessageList } from '#server/stores/scheduledMessageStore.js';
import type { ScheduledMessageList } from '#server/types/scheduledMessage.js';

/** Return scheduled messages with the most recent schedules first. */
export async function fetchScheduledMessageList(): Promise<ScheduledMessageList> {
  const list = await getScheduledMessageList();
  return [...list].sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );
}
