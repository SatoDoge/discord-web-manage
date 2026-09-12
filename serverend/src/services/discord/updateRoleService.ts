import {
  updateGuildRole,
  type UpdateGuildRoleError,
  type UpdateGuildRoleInput,
} from '#server/discord/updateRole.js';
import type { GuildRoleSummary } from '#server/discord/getRoleList.js';
import { invalidateRoleListCache } from '#server/services/discord/getRoleListService.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type UpdateRoleValidationError =
  | 'invalid_role_id'
  | 'empty_update'
  | 'invalid_name'
  | 'invalid_color'
  | 'invalid_hoist'
  | 'invalid_mentionable'
  | 'invalid_permissions'
  | 'invalid_position'
  | 'invalid_reason';

export type UpdateRoleResult =
  | { ok: true; data: GuildRoleSummary }
  | {
      ok: false;
      status: number;
      error: UpdateGuildRoleError | UpdateRoleValidationError;
    };

const MAX_NAME_LENGTH = 100;
const MAX_COLOR = 0xffffff;

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function errorStatus(error: UpdateGuildRoleError): number {
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
    case 'update_failed':
      return 502;
    default:
      return 400;
  }
}

export type UpdateRoleBody = {
  name?: unknown;
  color?: unknown;
  hoist?: unknown;
  mentionable?: unknown;
  permissions?: unknown;
  position?: unknown;
  reason?: unknown;
};

function parseUpdateInput(
  body: UpdateRoleBody,
):
  | { ok: true; input: UpdateGuildRoleInput }
  | { ok: false; error: Exclude<UpdateRoleValidationError, 'invalid_role_id'> } {
  const input: UpdateGuildRoleInput = {};
  let hasField = false;

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > MAX_NAME_LENGTH) {
      return { ok: false, error: 'invalid_name' };
    }
    input.name = body.name.trim();
    hasField = true;
  }

  if (body.color !== undefined) {
    if (body.color === null) {
      input.color = null;
      hasField = true;
    } else if (
      typeof body.color !== 'number' ||
      !Number.isInteger(body.color) ||
      body.color < 0 ||
      body.color > MAX_COLOR
    ) {
      return { ok: false, error: 'invalid_color' };
    } else {
      input.color = body.color;
      hasField = true;
    }
  }

  if (body.hoist !== undefined) {
    if (typeof body.hoist !== 'boolean') {
      return { ok: false, error: 'invalid_hoist' };
    }
    input.hoist = body.hoist;
    hasField = true;
  }

  if (body.mentionable !== undefined) {
    if (typeof body.mentionable !== 'boolean') {
      return { ok: false, error: 'invalid_mentionable' };
    }
    input.mentionable = body.mentionable;
    hasField = true;
  }

  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions) || !body.permissions.every((flag) => typeof flag === 'string')) {
      return { ok: false, error: 'invalid_permissions' };
    }
    input.permissions = body.permissions;
    hasField = true;
  }

  if (body.position !== undefined) {
    if (typeof body.position !== 'number' || !Number.isInteger(body.position) || body.position < 0) {
      return { ok: false, error: 'invalid_position' };
    }
    input.position = body.position;
    hasField = true;
  }

  if (body.reason !== undefined) {
    if (typeof body.reason !== 'string') {
      return { ok: false, error: 'invalid_reason' };
    }
    input.reason = body.reason;
  }

  if (!hasField) {
    return { ok: false, error: 'empty_update' };
  }

  return { ok: true, input };
}

/** Validate input and update a guild role. */
export async function updateRole(
  roleId: string,
  body: UpdateRoleBody,
  context: AuthenticatedServiceContext,
): Promise<UpdateRoleResult> {
  if (!isSnowflake(roleId)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'role.update',
      category: 'role',
      targetType: 'role',
      targetId: roleId,
      success: false,
      errorMessage: 'invalid_role_id',
      summary: 'ロール更新に失敗しました',
    });
    return { ok: false, status: 400, error: 'invalid_role_id' };
  }

  const parsed = parseUpdateInput(body);
  if (!parsed.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'role.update',
      category: 'role',
      targetType: 'role',
      targetId: roleId,
      success: false,
      errorMessage: parsed.error,
      summary: 'ロール更新に失敗しました',
      metadata: { body },
    });
    return { ok: false, status: 400, error: parsed.error };
  }

  const result = await updateGuildRole(roleId, parsed.input);
  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'role.update',
      category: 'role',
      targetType: 'role',
      targetId: roleId,
      success: false,
      errorMessage: result.error,
      summary: 'ロール更新に失敗しました',
      metadata: { input: parsed.input },
    });
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  invalidateRoleListCache();
  recordAuthenticatedAdminOperation(context, {
    action: 'role.update',
    category: 'role',
    targetType: 'role',
    targetId: roleId,
    success: true,
    summary: `ロール「${result.data.name}」を更新しました`,
    metadata: { input: parsed.input },
  });

  return { ok: true, data: result.data };
}
