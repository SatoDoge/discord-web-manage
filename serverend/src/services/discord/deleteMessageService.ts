import {
  deleteGuildMessage,
  type DeleteMessageError,
} from '#server/discord/deleteMessage.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type { DeleteMessageError };

export type DeleteMessageServiceResult =
  | { ok: true }
  | { ok: false; status: number; error: DeleteMessageError | 'invalid_channel_id' | 'invalid_message_id' };

const SNOWFLAKE_RE = /^\d{17,20}$/;

function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && SNOWFLAKE_RE.test(value);
}

function errorStatus(error: DeleteMessageError): number {
  switch (error) {
    case 'bot_not_connected':
      return 503;
    case 'channel_not_found':
    case 'message_not_found':
      return 404;
    case 'channel_not_text':
    case 'missing_permission':
    case 'not_deletable':
      return 403;
    default:
      return 400;
  }
}

/**
 * Validate input and delete a guild message by channel and message IDs.
 */
export async function deleteMessage(
  channelId: unknown,
  messageId: unknown,
  reason: unknown,
  context: AuthenticatedServiceContext,
): Promise<DeleteMessageServiceResult> {
  if (!isSnowflake(channelId)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'message.delete',
      category: 'message',
      targetType: 'message',
      targetId: typeof messageId === 'string' ? messageId : null,
      success: false,
      errorMessage: 'invalid_channel_id',
      summary: 'メッセージの削除に失敗しました（無効なチャンネルID）',
      metadata: { channelId, messageId },
    });
    return { ok: false, status: 400, error: 'invalid_channel_id' };
  }
  if (!isSnowflake(messageId)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'message.delete',
      category: 'message',
      targetType: 'message',
      targetId: null,
      success: false,
      errorMessage: 'invalid_message_id',
      summary: 'メッセージの削除に失敗しました（無効なメッセージID）',
      metadata: { channelId, messageId },
    });
    return { ok: false, status: 400, error: 'invalid_message_id' };
  }

  const auditReason =
    typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;

  const result = await deleteGuildMessage(channelId, messageId, auditReason);
  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'message.delete',
      category: 'message',
      targetType: 'message',
      targetId: messageId,
      success: false,
      errorMessage: result.error,
      summary: 'メッセージの削除に失敗しました',
      metadata: { channelId, messageId, reason: auditReason },
    });
    return {
      ok: false,
      status: errorStatus(result.error),
      error: result.error,
    };
  }

  recordAuthenticatedAdminOperation(context, {
    action: 'message.delete',
    category: 'message',
    targetType: 'message',
    targetId: messageId,
    success: true,
    summary: 'メッセージを削除しました',
    metadata: { channelId, messageId, reason: auditReason },
  });

  return { ok: true };
}
