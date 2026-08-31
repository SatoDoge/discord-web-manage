import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { updateAdminUserList } from '#server/stores/adminUserStore.js';
import type { AdminUser } from '#server/types/adminUser.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type RemoveAdminUserResult =
  | { ok: true; user: AdminUser }
  | {
      ok: false;
      status: number;
      error: 'invalid_user_id' | 'admin_not_found';
    };

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

/** Remove an admin user by Discord user id. */
export async function removeAdminUser(
  userId: string,
  context: AuthenticatedServiceContext,
): Promise<RemoveAdminUserResult> {
  if (!isSnowflake(userId)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'admin_user.remove',
      category: 'admin_user',
      targetType: 'user',
      targetId: userId,
      success: false,
      errorMessage: 'invalid_user_id',
      summary: '管理者ユーザーの削除に失敗しました（無効なユーザーID）',
    });
    return { ok: false, status: 400, error: 'invalid_user_id' };
  }

  let removed: AdminUser | undefined;

  await updateAdminUserList((list) => {
    const index = list.findIndex((entry) => entry.id === userId);
    if (index === -1) {
      return list;
    }

    removed = list[index];
    const next = [...list];
    next.splice(index, 1);
    return next;
  });

  if (!removed) {
    recordAuthenticatedAdminOperation(context, {
      action: 'admin_user.remove',
      category: 'admin_user',
      targetType: 'user',
      targetId: userId,
      success: false,
      errorMessage: 'admin_not_found',
      summary: '管理者ユーザーの削除に失敗しました（管理者が見つかりません）',
    });
    return { ok: false, status: 404, error: 'admin_not_found' };
  }

  recordAuthenticatedAdminOperation(context, {
    action: 'admin_user.remove',
    category: 'admin_user',
    targetType: 'user',
    targetId: removed.id,
    success: true,
    summary: `管理者ユーザーを削除しました（${removed.displayName ?? removed.username}）`,
    metadata: {
      username: removed.username,
      displayName: removed.displayName,
    },
  });

  return { ok: true, user: removed };
}
