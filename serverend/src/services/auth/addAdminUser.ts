import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { getMember } from '#server/stores/memberStore.js';
import { updateAdminUserList } from '#server/stores/adminUserStore.js';
import type { AdminUser } from '#server/types/adminUser.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
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
export async function addAdminUser(
  userId: string,
  context: AuthenticatedServiceContext,
): Promise<AddAdminUserResult> {
  if (!isSnowflake(userId)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'admin_user.add',
      category: 'admin_user',
      targetType: 'user',
      targetId: userId,
      success: false,
      errorMessage: 'invalid_user_id',
      summary: '管理者ユーザーの追加に失敗しました（無効なユーザーID）',
    });
    return { ok: false, status: 400, error: 'invalid_user_id' };
  }

  const member = await getMember(userId);
  if (!member) {
    recordAuthenticatedAdminOperation(context, {
      action: 'admin_user.add',
      category: 'admin_user',
      targetType: 'user',
      targetId: userId,
      success: false,
      errorMessage: 'member_not_found',
      summary: '管理者ユーザーの追加に失敗しました（メンバーが見つかりません）',
    });
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

  recordAuthenticatedAdminOperation(context, {
    action: 'admin_user.add',
    category: 'admin_user',
    targetType: 'user',
    targetId: admin.id,
    success: true,
    summary: `管理者ユーザーを追加しました（${admin.displayName ?? admin.username}）`,
    metadata: {
      username: admin.username,
      displayName: admin.displayName,
    },
  });

  return { ok: true, user: admin };
}
