import { updateAdminUserList } from '#server/stores/adminUserStore.js';
import type { AdminUser } from '#server/types/adminUser.js';

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
): Promise<RemoveAdminUserResult> {
  if (!isSnowflake(userId)) {
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
    return { ok: false, status: 404, error: 'admin_not_found' };
  }

  return { ok: true, user: removed };
}
