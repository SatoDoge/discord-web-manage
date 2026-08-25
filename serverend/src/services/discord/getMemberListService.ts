import { getMemberList } from '#server/stores/memberStore.js';
import type { StoredGuildMemberList } from '#server/types/member.js';

/** All guild members from the local member store. */
export function fetchMemberList(): Promise<StoredGuildMemberList> {
  return getMemberList();
}
