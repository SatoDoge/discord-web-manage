import { deleteGuildMessage } from '#server/discord/deleteMessage.js';
import { recordAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { updateMessage } from '#server/stores/messageDataStore.js';
import {
  appendMeasuredMessage,
  createMeasuredEntry,
  emptyMeasuredDetail,
} from '#server/services/message/measuredMessageRecord.js';
import { getStoredMessageForMeasure } from '#server/services/message/getStoredMessageForMeasure.js';
import type { StoredGuildMessage } from '#server/types/messageData.js';

export type DeleteStoredMessageError =
  | 'message_not_found'
  | 'not_filtered'
  | 'delete_failed';

export type DeleteStoredMessageResult =
  | { ok: true; data: StoredGuildMessage }
  | { ok: false; error: DeleteStoredMessageError; deleteError?: string };

export async function deleteStoredMessage(
  messageId: string,
  operationUserId: string,
): Promise<DeleteStoredMessageResult> {
  const lookup = await getStoredMessageForMeasure(messageId);
  if (!lookup.ok) {
    recordAdminOperation({
      actorUserId: operationUserId,
      action: 'message.filtered.delete',
      category: 'message',
      targetType: 'message',
      targetId: messageId,
      success: false,
      errorMessage: lookup.error,
      summary: 'フィルター済みメッセージの削除に失敗しました',
    });
    return { ok: false, error: lookup.error };
  }

  const stored = lookup.message;
  const result = await deleteGuildMessage(stored.channelId, stored.messageId);
  const isDeleted = result.ok;

  appendMeasuredMessage(
    stored,
    createMeasuredEntry(operationUserId, {
      command: isDeleted ? 'delete' : 'none',
      ...emptyMeasuredDetail(),
      deleteDetail: { isDeleted },
    }),
  );

  if (isDeleted) {
    stored.isDeleted = true;
    stored.deletedAt = new Date().toISOString();
  }

  const updated = await updateMessage(stored);

  if (!isDeleted) {
    recordAdminOperation({
      actorUserId: operationUserId,
      action: 'message.filtered.delete',
      category: 'message',
      targetType: 'message',
      targetId: messageId,
      success: false,
      errorMessage: result.ok ? undefined : result.error,
      summary: 'フィルター済みメッセージの削除に失敗しました',
      metadata: { channelId: stored.channelId },
    });
    return {
      ok: false,
      error: 'delete_failed',
      deleteError: result.ok ? undefined : result.error,
    };
  }

  recordAdminOperation({
    actorUserId: operationUserId,
    action: 'message.filtered.delete',
    category: 'message',
    targetType: 'message',
    targetId: messageId,
    success: true,
    summary: 'フィルター済みメッセージを削除しました',
    metadata: {
      channelId: stored.channelId,
      authorUserId: stored.author.userId,
    },
  });

  return { ok: true, data: updated };
}
