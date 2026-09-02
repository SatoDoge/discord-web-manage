import { getMemberList } from '#server/stores/memberStore.js';
import type { StoredGuildMember, StoredGuildMemberList } from '#server/types/member.js';

function isOnlineMember(member: StoredGuildMember): boolean {
  const status = member.presence?.status;
  return status != null && status !== 'offline';
}

/** Guild members whose presence is online, idle, or dnd (from the local member store). */
export async function fetchOnlineMemberList(): Promise<StoredGuildMemberList> {
  const members = await getMemberList();
  return members.filter(isOnlineMember);
}
