import {
  deleteGuildChannel,
  type DeleteGuildChannelError,
} from '#server/discord/deleteChannel.js';
import type { GuildChannelDetail } from '#server/discord/getChannelDetail.js';
import { invalidateChannelListCache } from '#server/services/discord/getChannelListService.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type DeleteChannelResult =
  | { ok: true; data: GuildChannelDetail }
  | {
      ok: false;
      status: number;
      error: DeleteGuildChannelError | 'invalid_channel_id' | 'invalid_reason';
    };

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function errorStatus(error: DeleteGuildChannelError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'channel_not_found':
    case 'guild_not_found':
      return 404;
    case 'missing_permission':
      return 403;
    case 'delete_failed':
      return 502;
    default:
      return 400;
  }
}

/** Delete a guild channel and record the admin operation. */
export async function deleteChannel(
  channelId: string,
  reason: unknown,
  context: AuthenticatedServiceContext,
): Promise<DeleteChannelResult> {
  if (!isSnowflake(channelId)) {
    return { ok: false, status: 400, error: 'invalid_channel_id' };
  }
  if (reason !== undefined && typeof reason !== 'string') {
    return { ok: false, status: 400, error: 'invalid_reason' };
  }

  const result = await deleteGuildChannel(
    channelId,
    typeof reason === 'string' ? reason : undefined,
  );
  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'channel.delete',
      category: 'channel',
      targetType: 'channel',
      targetId: channelId,
      success: false,
      errorMessage: result.error,
      summary: 'チャンネル削除に失敗しました',
    });
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  invalidateChannelListCache();
  recordAuthenticatedAdminOperation(context, {
    action: 'channel.delete',
    category: 'channel',
    targetType: 'channel',
    targetId: channelId,
    success: true,
    summary: `チャンネル「${result.data.name}」を削除しました`,
    metadata: {
      type: result.data.type,
      parentId: result.data.parentId,
      reason: typeof reason === 'string' ? reason : null,
    },
  });

  return { ok: true, data: result.data };
}
