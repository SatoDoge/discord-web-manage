import { getMemberJoinEvent } from '#server/stores/memberJoinDataStore.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';

export type FetchMemberJoinEventResult =
  | { ok: true; data: StoredMemberJoinEvent }
  | { ok: false; error: 'join_event_not_found' };

export async function fetchStoredMemberJoinEvent(
  joinEventId: string,
): Promise<FetchMemberJoinEventResult> {
  const event = await getMemberJoinEvent(joinEventId);
  if (!event) {
    return { ok: false, error: 'join_event_not_found' };
  }

  return { ok: true, data: event };
}
