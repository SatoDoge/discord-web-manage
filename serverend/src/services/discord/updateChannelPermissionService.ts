import { OverwriteType } from 'discord.js';
import {
  deleteGuildChannelPermission,
  updateGuildChannelPermission,
  type ChannelPermissionUpdateInput,
  type GuildChannelDetail,
  type UpdateChannelPermissionError,
} from '#server/discord/getChannelDetail.js';
import { invalidateChannelListCache } from '#server/services/discord/getChannelListService.js';
import { invalidateChannelDetailCache } from '#server/services/discord/getChannelDetailService.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type UpdateChannelPermissionResult =
  | { ok: true; data: GuildChannelDetail }
  | {
      ok: false;
      status: number;
      error:
        | UpdateChannelPermissionError
        | 'invalid_channel_id'
        | 'invalid_overwrite_id'
        | 'empty_update'
        | 'invalid_reason'
        | 'invalid_permissions'
        | 'overwrite_not_found'
        | 'delete_failed';
    };

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function errorStatus(error: string): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'channel_not_found':
    case 'guild_not_found':
    case 'overwrite_not_found':
      return 404;
    case 'missing_permission':
      return 403;
    case 'update_failed':
    case 'delete_failed':
      return 502;
    default:
      return 400;
  }
}

export type UpdateChannelPermissionBody = {
  permissions?: unknown;
  allow?: unknown;
  deny?: unknown;
  type?: unknown;
  reason?: unknown;
};

function parsePermissionInput(
  body: UpdateChannelPermissionBody,
):
  | { ok: true; input: ChannelPermissionUpdateInput }
  | {
      ok: false;
      error: 'empty_update' | 'invalid_permissions' | 'invalid_overwrite_type' | 'invalid_reason';
    } {
  const input: ChannelPermissionUpdateInput = {};
  let hasField = false;

  if (body.permissions !== undefined) {
    if (
      body.permissions === null ||
      typeof body.permissions !== 'object' ||
      Array.isArray(body.permissions)
    ) {
      return { ok: false, error: 'invalid_permissions' };
    }
    const permissions: Record<string, boolean | null> = {};
    for (const [key, value] of Object.entries(body.permissions as Record<string, unknown>)) {
      if (value !== true && value !== false && value !== null) {
        return { ok: false, error: 'invalid_permissions' };
      }
      permissions[key] = value;
    }
    input.permissions = permissions;
    hasField = true;
  }

  if (body.allow !== undefined) {
    if (!Array.isArray(body.allow) || !body.allow.every((flag) => typeof flag === 'string')) {
      return { ok: false, error: 'invalid_permissions' };
    }
    input.allow = body.allow;
    hasField = true;
  }

  if (body.deny !== undefined) {
    if (!Array.isArray(body.deny) || !body.deny.every((flag) => typeof flag === 'string')) {
      return { ok: false, error: 'invalid_permissions' };
    }
    input.deny = body.deny;
    hasField = true;
  }

  if (body.type !== undefined) {
    if (body.type !== OverwriteType.Role && body.type !== OverwriteType.Member) {
      return { ok: false, error: 'invalid_overwrite_type' };
    }
    input.type = body.type;
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

/** Create or update a channel permission overwrite for a role or member. */
export async function updateChannelPermission(
  channelId: string,
  overwriteId: string,
  body: UpdateChannelPermissionBody,
  context: AuthenticatedServiceContext,
): Promise<UpdateChannelPermissionResult> {
  if (!isSnowflake(channelId)) {
    return { ok: false, status: 400, error: 'invalid_channel_id' };
  }
  if (!isSnowflake(overwriteId)) {
    return { ok: false, status: 400, error: 'invalid_overwrite_id' };
  }

  const parsed = parsePermissionInput(body);
  if (!parsed.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'channel.permission_update',
      category: 'channel',
      targetType: 'channel',
      targetId: channelId,
      success: false,
      errorMessage: parsed.error,
      summary: 'チャンネル権限の更新に失敗しました',
      metadata: { overwriteId, body },
    });
    return { ok: false, status: 400, error: parsed.error };
  }

  const result = await updateGuildChannelPermission(channelId, overwriteId, parsed.input);
  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'channel.permission_update',
      category: 'channel',
      targetType: 'channel',
      targetId: channelId,
      success: false,
      errorMessage: result.error,
      summary: 'チャンネル権限の更新に失敗しました',
      metadata: { overwriteId, input: parsed.input },
    });
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  invalidateChannelListCache();
  invalidateChannelDetailCache(channelId);
  recordAuthenticatedAdminOperation(context, {
    action: 'channel.permission_update',
    category: 'channel',
    targetType: 'channel',
    targetId: channelId,
    success: true,
    summary: `チャンネル「${result.data.name}」の権限を更新しました`,
    metadata: { overwriteId, input: parsed.input },
  });

  return { ok: true, data: result.data };
}

/** Delete a channel permission overwrite. */
export async function deleteChannelPermission(
  channelId: string,
  overwriteId: string,
  reason: unknown,
  context: AuthenticatedServiceContext,
): Promise<UpdateChannelPermissionResult> {
  if (!isSnowflake(channelId)) {
    return { ok: false, status: 400, error: 'invalid_channel_id' };
  }
  if (!isSnowflake(overwriteId)) {
    return { ok: false, status: 400, error: 'invalid_overwrite_id' };
  }
  if (reason !== undefined && typeof reason !== 'string') {
    return { ok: false, status: 400, error: 'invalid_reason' };
  }

  const result = await deleteGuildChannelPermission(
    channelId,
    overwriteId,
    typeof reason === 'string' ? reason : undefined,
  );
  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'channel.permission_delete',
      category: 'channel',
      targetType: 'channel',
      targetId: channelId,
      success: false,
      errorMessage: result.error,
      summary: 'チャンネル権限の削除に失敗しました',
      metadata: { overwriteId },
    });
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  invalidateChannelListCache();
  invalidateChannelDetailCache(channelId);
  recordAuthenticatedAdminOperation(context, {
    action: 'channel.permission_delete',
    category: 'channel',
    targetType: 'channel',
    targetId: channelId,
    success: true,
    summary: `チャンネル「${result.data.name}」の権限オーバーライトを削除しました`,
    metadata: { overwriteId },
  });

  return { ok: true, data: result.data };
}
