import {
  createGuildRole,
  type CreateGuildRoleError,
  type CreateGuildRoleInput,
} from '#server/discord/createRole.js';
import type { GuildRoleSummary } from '#server/discord/getRoleList.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { invalidateRoleListCache } from '#server/services/discord/getRoleListService.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type CreateRoleValidationError =
  | 'invalid_name'
  | 'invalid_color'
  | 'invalid_hoist'
  | 'invalid_mentionable'
  | 'invalid_permissions'
  | 'invalid_reason';

export type CreateRoleResult =
  | { ok: true; data: GuildRoleSummary }
  | {
      ok: false;
      status: number;
      error: CreateGuildRoleError | CreateRoleValidationError;
    };

const MAX_NAME_LENGTH = 100;
const MAX_COLOR = 0xffffff;

function errorStatus(error: CreateGuildRoleError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'guild_not_found':
      return 404;
    case 'missing_permission':
      return 403;
    case 'create_failed':
      return 502;
    default:
      return 400;
  }
}

export type CreateRoleBody = {
  name?: unknown;
  color?: unknown;
  hoist?: unknown;
  mentionable?: unknown;
  permissions?: unknown;
  reason?: unknown;
};

function parseCreateInput(
  body: CreateRoleBody,
):
  | { ok: true; input: CreateGuildRoleInput }
  | { ok: false; error: CreateRoleValidationError } {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > MAX_NAME_LENGTH) {
    return { ok: false, error: 'invalid_name' };
  }

  const input: CreateGuildRoleInput = {
    name: body.name.trim(),
  };

  if (body.color !== undefined && body.color !== null) {
    if (typeof body.color !== 'number' || !Number.isInteger(body.color) || body.color < 0 || body.color > MAX_COLOR) {
      return { ok: false, error: 'invalid_color' };
    }
    input.color = body.color;
  }

  if (body.hoist !== undefined) {
    if (typeof body.hoist !== 'boolean') {
      return { ok: false, error: 'invalid_hoist' };
    }
    input.hoist = body.hoist;
  }

  if (body.mentionable !== undefined) {
    if (typeof body.mentionable !== 'boolean') {
      return { ok: false, error: 'invalid_mentionable' };
    }
    input.mentionable = body.mentionable;
  }

  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions) || !body.permissions.every((flag) => typeof flag === 'string')) {
      return { ok: false, error: 'invalid_permissions' };
    }
    input.permissions = body.permissions;
  }

  if (body.reason !== undefined) {
    if (typeof body.reason !== 'string') {
      return { ok: false, error: 'invalid_reason' };
    }
    input.reason = body.reason;
  }

  return { ok: true, input };
}

/** Validate input and create a guild role. */
export async function createRole(
  body: CreateRoleBody,
  context: AuthenticatedServiceContext,
): Promise<CreateRoleResult> {
  const parsed = parseCreateInput(body);
  if (!parsed.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'role.create',
      category: 'role',
      targetType: 'role',
      success: false,
      errorMessage: parsed.error,
      summary: 'ロール作成に失敗しました',
      metadata: { body },
    });
    return { ok: false, status: 400, error: parsed.error };
  }

  const result = await createGuildRole(parsed.input);
  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'role.create',
      category: 'role',
      targetType: 'role',
      success: false,
      errorMessage: result.error,
      summary: 'ロール作成に失敗しました',
      metadata: { input: parsed.input },
    });
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  invalidateRoleListCache();
  recordAuthenticatedAdminOperation(context, {
    action: 'role.create',
    category: 'role',
    targetType: 'role',
    targetId: result.data.id,
    success: true,
    summary: `ロール「${result.data.name}」を作成しました`,
    metadata: { input: parsed.input },
  });

  return { ok: true, data: result.data };
}
