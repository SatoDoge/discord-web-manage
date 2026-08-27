import { getAdminUserList } from '#server/stores/adminUserStore.js';
import { getMemberList } from '#server/stores/memberStore.js';
import type { StoredGuildMember, StoredGuildMemberList } from '#server/types/member.js';

export type MemberAccountKind = 'bot' | 'admin' | 'member';

export type ManagedGuildMember = StoredGuildMember & {
  accountKind: MemberAccountKind;
};

export type ManagedGuildMemberList = ManagedGuildMember[];

function resolveAccountKind(
  member: StoredGuildMember,
  adminIds: Set<string>,
): MemberAccountKind {
  if (member.bot) {
    return 'bot';
  }
  if (adminIds.has(member.id)) {
    return 'admin';
  }
  return 'member';
}

/** All guild members from the local store, with account kind for the manage UI. */
export async function fetchMemberList(): Promise<ManagedGuildMemberList> {
  const [members, admins] = await Promise.all([getMemberList(), getAdminUserList()]);
  const adminIds = new Set(admins.map((admin) => admin.id));

  return members.map((member) => ({
    ...member,
    accountKind: resolveAccountKind(member, adminIds),
  }));
}

export type { StoredGuildMemberList };
