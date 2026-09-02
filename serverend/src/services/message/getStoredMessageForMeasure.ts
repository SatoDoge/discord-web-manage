import { getMessage } from '#server/stores/messageDataStore.js';
import type { StoredGuildMessage } from '#server/types/messageData.js';

export type StoredMessageMeasureError = 'message_not_found' | 'not_filtered';

export type StoredMessageMeasureResult =
  | { ok: true; message: StoredGuildMessage }
  | { ok: false; error: StoredMessageMeasureError };

export async function getStoredMessageForMeasure(
  messageId: string,
): Promise<StoredMessageMeasureResult> {
  const message = await getMessage(messageId);
  if (!message) {
    return { ok: false, error: 'message_not_found' };
  }

  if (!message.isFiltered) {
    return { ok: false, error: 'not_filtered' };
  }

  return { ok: true, message };
}
