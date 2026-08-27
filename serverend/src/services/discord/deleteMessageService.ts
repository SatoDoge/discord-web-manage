import {
  deleteGuildMessage,
  type DeleteMessageError,
} from '#server/discord/deleteMessage.js';

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
  reason?: unknown,
): Promise<DeleteMessageServiceResult> {
  if (!isSnowflake(channelId)) {
    return { ok: false, status: 400, error: 'invalid_channel_id' };
  }
  if (!isSnowflake(messageId)) {
    return { ok: false, status: 400, error: 'invalid_message_id' };
  }

  const auditReason =
    typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;

  const result = await deleteGuildMessage(channelId, messageId, auditReason);
  if (!result.ok) {
    return {
      ok: false,
      status: errorStatus(result.error),
      error: result.error,
    };
  }

  return { ok: true };
}
