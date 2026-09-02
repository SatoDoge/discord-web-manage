import { getBotPostedMessage } from '#server/stores/botPostedMessageStore.js';
import type { BotPostedMessage } from '#server/types/botPostedMessage.js';
import { isSnowflake } from '#server/services/botPostedMessage/embedValidation.js';

export type FetchBotPostedMessageResult =
  | { ok: true; data: BotPostedMessage }
  | { ok: false; status: number; error: 'invalid_message_id' | 'message_not_found' };

export async function fetchBotPostedMessage(
  messageId: unknown,
): Promise<FetchBotPostedMessageResult> {
  if (!isSnowflake(messageId)) {
    return { ok: false, status: 400, error: 'invalid_message_id' };
  }

  const message = await getBotPostedMessage(messageId);
  if (!message) {
    return { ok: false, status: 404, error: 'message_not_found' };
  }

  return { ok: true, data: message };
}
