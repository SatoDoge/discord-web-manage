import { getAdminUserList } from '#server/stores/adminUserStore.js';
import type { AdminUser } from '#server/types/adminUser.js';

/**
 * Resolve the authenticated admin's profile from adminUserList.
 */
export async function getAuthenticatedUserState(
  userId: string,
): Promise<AdminUser | null> {
  const list = await getAdminUserList();
  return list.find((user) => user.id === userId) ?? null;
}
