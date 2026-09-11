import {
  deleteGuildRole,
  type DeleteGuildRoleError,
} from '#server/discord/deleteRole.js';
import type { GuildRoleSummary } from '#server/discord/getRoleList.js';
import { invalidateRoleListCache } from '#server/services/discord/getRoleListService.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type DeleteRoleResult =
  | { ok: true; data: GuildRoleSummary }
  | {
      ok: false;
      status: number;
      error: DeleteGuildRoleError | 'invalid_role_id' | 'invalid_reason';
    };

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function errorStatus(error: DeleteGuildRoleError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'role_not_found':
    case 'guild_not_found':
      return 404;
    case 'missing_permission':
    case 'role_not_editable':
      return 403;
    case 'delete_failed':
      return 502;
    default:
      return 400;
  }
}

/** Delete a guild role and record the admin operation. */
export async function deleteRole(
  roleId: string,
  reason: unknown,
  context: AuthenticatedServiceContext,
): Promise<DeleteRoleResult> {
  if (!isSnowflake(roleId)) {
    return { ok: false, status: 400, error: 'invalid_role_id' };
  }
  if (reason !== undefined && typeof reason !== 'string') {
    return { ok: false, status: 400, error: 'invalid_reason' };
  }

  const result = await deleteGuildRole(
    roleId,
    typeof reason === 'string' ? reason : undefined,
  );
  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'role.delete',
      category: 'role',
      targetType: 'role',
      targetId: roleId,
      success: false,
      errorMessage: result.error,
      summary: 'ロール削除に失敗しました',
    });
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  invalidateRoleListCache();
  recordAuthenticatedAdminOperation(context, {
    action: 'role.delete',
    category: 'role',
    targetType: 'role',
    targetId: roleId,
    success: true,
    summary: `ロール「${result.data.name}」を削除しました`,
    metadata: {
      reason: typeof reason === 'string' ? reason : null,
    },
  });

  return { ok: true, data: result.data };
}
