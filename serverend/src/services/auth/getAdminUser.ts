import { getAdminUserList } from '#server/stores/adminUserStore.js';
import type { AdminUser, AdminUserList } from '#server/types/adminUser.js';

export type GetAdminUserResult =
  | { ok: true; user: AdminUser }
  | {
      ok: false;
      status: number;
      error: 'invalid_user_id' | 'admin_not_found';
    };

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

/** Return all admin users. */
export function getAdminUsers(): Promise<AdminUserList> {
  return getAdminUserList();
}

/** Return a single admin user by Discord user id. */
export async function getAdminUser(userId: string): Promise<GetAdminUserResult> {
  if (!isSnowflake(userId)) {
    return { ok: false, status: 400, error: 'invalid_user_id' };
  }

  const list = await getAdminUserList();
  const user = list.find((entry) => entry.id === userId);
  if (!user) {
    return { ok: false, status: 404, error: 'admin_not_found' };
  }

  return { ok: true, user };
}
