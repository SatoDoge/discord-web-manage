import {
  deleteGuildMessage,
  type DeleteMessageError,
} from '#server/discord/deleteMessage.js';
import {
  getBotPostedMessage,
  updateBotPostedMessage,
} from '#server/stores/botPostedMessageStore.js';
import { isSnowflake } from '#server/services/botPostedMessage/embedValidation.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { BotPostedMessage } from '#server/types/botPostedMessage.js';

export type DeleteBotPostedMessageServiceResult =
  | { ok: true; data: BotPostedMessage }
  | {
      ok: false;
      status: number;
      error:
        | DeleteMessageError
        | 'invalid_message_id'
        | 'message_not_found'
        | 'already_deleted';
    };

function errorStatus(
  error: DeleteMessageError | 'already_deleted',
): number {
  switch (error) {
    case 'bot_not_connected':
      return 503;
    case 'channel_not_found':
    case 'message_not_found':
      return 404;
    case 'channel_not_text':
    case 'missing_permission':
    case 'not_deletable':
    case 'already_deleted':
      return 403;
    default:
      return 400;
  }
}

/**
 * Delete a bot-posted message on Discord and mark it deleted in the local record.
 */
export async function deleteStoredBotPostedMessage(
  messageId: unknown,
  reason: unknown,
  context: AuthenticatedServiceContext,
): Promise<DeleteBotPostedMessageServiceResult> {
  if (!isSnowflake(messageId)) {
    return { ok: false, status: 400, error: 'invalid_message_id' };
  }

  const stored = await getBotPostedMessage(messageId);
  if (!stored) {
    return { ok: false, status: 404, error: 'message_not_found' };
  }
  if (stored.isDeleted) {
    return { ok: false, status: 403, error: 'already_deleted' };
  }

  const auditReason =
    typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;

  const result = await deleteGuildMessage(
    stored.channelId,
    stored.messageId,
    auditReason,
  );

  const discordAlreadyDeleted = !result.ok && result.error === 'message_not_found';

  if (!result.ok && !discordAlreadyDeleted) {
    recordAuthenticatedAdminOperation(context, {
      action: 'bot_message.delete',
      category: 'message',
      targetType: 'message',
      targetId: stored.messageId,
      success: false,
      errorMessage: result.error,
      summary: 'Bot投稿メッセージの削除に失敗しました',
      metadata: { channelId: stored.channelId },
    });
    return {
      ok: false,
      status: errorStatus(result.error),
      error: result.error,
    };
  }

  const updated = await updateBotPostedMessage(stored.messageId, {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
  });

  recordAuthenticatedAdminOperation(context, {
    action: 'bot_message.delete',
    category: 'message',
    targetType: 'message',
    targetId: stored.messageId,
    success: true,
    summary: 'Bot投稿メッセージを削除しました',
    metadata: {
      channelId: stored.channelId,
      reason: auditReason ?? null,
      discordAlreadyDeleted,
    },
  });

  return { ok: true, data: updated };
}
