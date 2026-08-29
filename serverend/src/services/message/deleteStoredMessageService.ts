import { deleteGuildMessage } from '#server/discord/deleteMessage.js';
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
    return {
      ok: false,
      error: 'delete_failed',
      deleteError: result.ok ? undefined : result.error,
    };
  }

  return { ok: true, data: updated };
}
