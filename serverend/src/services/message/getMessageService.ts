import { getMessage } from '#server/stores/messageDataStore.js';
import type { StoredGuildMessage } from '#server/types/messageData.js';

export type GetStoredMessageResult =
  | { ok: true; data: StoredGuildMessage }
  | { ok: false; error: 'message_not_found' };

export async function fetchStoredMessage(
  messageId: string,
): Promise<GetStoredMessageResult> {
  const message = await getMessage(messageId);
  if (!message) {
    return { ok: false, error: 'message_not_found' };
  }

  return { ok: true, data: message };
}
