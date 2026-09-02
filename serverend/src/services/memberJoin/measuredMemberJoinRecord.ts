import type { MeasuredMessage } from '#server/types/messageData.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';

export function appendMeasuredJoinEvent(
  stored: StoredMemberJoinEvent,
  entry: MeasuredMessage,
): void {
  const current = stored.measuredMessage ?? [];
  stored.measuredMessage = [...current, entry];
  stored.isMeasured = true;
}
