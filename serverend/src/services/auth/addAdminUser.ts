import { getMember } from '#server/stores/memberStore.js';
import { updateAdminUserList } from '#server/stores/adminUserStore.js';
import type { AdminUser } from '#server/types/adminUser.js';
import type { StoredGuildMember } from '#server/types/member.js';

export type AddAdminUserResult =
  | { ok: true; user: AdminUser }
  | {
      ok: false;
      status: number;
      error: 'invalid_user_id' | 'member_not_found';
    };

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function toAdminUserFromMember(member: StoredGuildMember): AdminUser {
  return {
    id: member.id,
    username: member.username,
    displayName: member.displayName,
    icon: member.avatarURL,
  };
}

/**
 * Add an admin user by Discord user id.
 * The user must already exist in memberStore.
 */
export async function addAdminUser(userId: string): Promise<AddAdminUserResult> {
  if (!isSnowflake(userId)) {
    return { ok: false, status: 400, error: 'invalid_user_id' };
  }

  const member = await getMember(userId);
  if (!member) {
    return { ok: false, status: 404, error: 'member_not_found' };
  }

  const admin = toAdminUserFromMember(member);
  await updateAdminUserList((list) => {
    const index = list.findIndex((entry) => entry.id === admin.id);
    if (index === -1) {
      return [...list, admin];
    }

    const next = [...list];
    next[index] = admin;
    return next;
  });

  return { ok: true, user: admin };
}
