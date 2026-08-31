import { getMemberJoinEventList } from '#server/stores/memberJoinDataStore.js';
import type { StoredMemberJoinEventList } from '#server/types/memberJoinData.js';

export async function fetchStoredMemberJoinEventList(): Promise<StoredMemberJoinEventList> {
  return getMemberJoinEventList();
}
