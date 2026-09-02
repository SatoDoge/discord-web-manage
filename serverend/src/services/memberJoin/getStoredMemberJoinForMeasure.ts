import { getMemberJoinEvent } from '#server/stores/memberJoinDataStore.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';

export type StoredMemberJoinMeasureError =
  | 'join_event_not_found'
  | 'not_filtered';

export type StoredMemberJoinMeasureResult =
  | { ok: true; event: StoredMemberJoinEvent }
  | { ok: false; error: StoredMemberJoinMeasureError };

export async function getStoredMemberJoinForMeasure(
  joinEventId: string,
): Promise<StoredMemberJoinMeasureResult> {
  const event = await getMemberJoinEvent(joinEventId);
  if (!event) {
    return { ok: false, error: 'join_event_not_found' };
  }

  if (!event.isFiltered) {
    return { ok: false, error: 'not_filtered' };
  }

  return { ok: true, event };
}
