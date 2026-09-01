import {
  replyChannelMessage,
  type ReplyChannelMessageError,
  type ReplyChannelMessageSuccess,
} from '#server/discord/replyChannelMessage.js';
import type { DiscordEmbedInput } from '#server/discord/types/embedInput.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type { ReplyChannelMessageError, ReplyChannelMessageSuccess };

export type ReplyChannelMessageServiceResult =
  | { ok: true; data: ReplyChannelMessageSuccess }
  | {
      ok: false;
      status: number;
      error:
        | ReplyChannelMessageError
        | 'invalid_channel_id'
        | 'invalid_message_id'
        | 'invalid_embeds'
        | 'invalid_fail_if_not_exists';
    };

const SNOWFLAKE_RE = /^\d{17,20}$/;

function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && SNOWFLAKE_RE.test(value);
}

function isEmbedInput(value: unknown): value is DiscordEmbedInput {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseEmbeds(value: unknown): DiscordEmbedInput[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every(isEmbedInput)) {
    return null;
  }
  return value;
}

function errorStatus(error: ReplyChannelMessageError): number {
  switch (error) {
    case 'bot_not_connected':
      return 503;
    case 'channel_not_found':
    case 'message_not_found':
      return 404;
    case 'channel_not_messageable':
    case 'missing_permission':
      return 403;
    default:
      return 400;
  }
}

function recordFailure(
  context: AuthenticatedServiceContext,
  error: string,
  metadata: Record<string, unknown>,
): void {
  recordAuthenticatedAdminOperation(context, {
    action: 'message.reply',
    category: 'message',
    targetType: 'message',
    targetId: typeof metadata.messageId === 'string' ? metadata.messageId : null,
    success: false,
    errorMessage: error,
    summary: 'メッセージへの返信に失敗しました',
    metadata,
  });
}

/**
 * Validate input and reply to a specific message in a Discord channel or thread.
 */
export async function postChannelMessageReply(
  body: {
    channelId?: unknown;
    messageId?: unknown;
    content?: unknown;
    embeds?: unknown;
    failIfNotExists?: unknown;
    reason?: unknown;
  },
  context: AuthenticatedServiceContext,
): Promise<ReplyChannelMessageServiceResult> {
  if (!isSnowflake(body.channelId)) {
    recordFailure(context, 'invalid_channel_id', {
      channelId: body.channelId,
      messageId: body.messageId,
    });
    return { ok: false, status: 400, error: 'invalid_channel_id' };
  }
  if (!isSnowflake(body.messageId)) {
    recordFailure(context, 'invalid_message_id', {
      channelId: body.channelId,
      messageId: body.messageId,
    });
    return { ok: false, status: 400, error: 'invalid_message_id' };
  }

  const embeds = parseEmbeds(body.embeds);
  if (embeds === null) {
    recordFailure(context, 'invalid_embeds', {
      channelId: body.channelId,
      messageId: body.messageId,
      embeds: body.embeds,
    });
    return { ok: false, status: 400, error: 'invalid_embeds' };
  }

  if (body.failIfNotExists !== undefined && typeof body.failIfNotExists !== 'boolean') {
    recordFailure(context, 'invalid_fail_if_not_exists', {
      channelId: body.channelId,
      messageId: body.messageId,
      failIfNotExists: body.failIfNotExists,
    });
    return { ok: false, status: 400, error: 'invalid_fail_if_not_exists' };
  }

  const content = typeof body.content === 'string' ? body.content : undefined;
  const reason = typeof body.reason === 'string' ? body.reason : undefined;
  const failIfNotExists =
    typeof body.failIfNotExists === 'boolean' ? body.failIfNotExists : undefined;

  if (!content?.trim() && embeds.length === 0) {
    recordFailure(context, 'empty_content', {
      channelId: body.channelId,
      messageId: body.messageId,
      hasContent: Boolean(content),
      embedCount: embeds.length,
    });
    return { ok: false, status: 400, error: 'empty_content' };
  }

  const result = await replyChannelMessage({
    channelId: body.channelId,
    messageId: body.messageId,
    content,
    embeds,
    failIfNotExists,
    reason,
  });

  if (!result.ok) {
    recordFailure(context, result.error, {
      channelId: body.channelId,
      messageId: body.messageId,
      embedCount: embeds.length,
      hasContent: Boolean(content?.trim()),
      failIfNotExists: failIfNotExists ?? true,
    });
    return {
      ok: false,
      status: errorStatus(result.error),
      error: result.error,
    };
  }

  recordAuthenticatedAdminOperation(context, {
    action: 'message.reply',
    category: 'message',
    targetType: 'message',
    targetId: result.data.messageId,
    success: true,
    summary: 'メッセージに返信しました',
    metadata: {
      channelId: body.channelId,
      messageId: result.data.messageId,
      referencedMessageId: result.data.referencedMessageId,
      threadId: result.data.threadId ?? null,
      embedCount: embeds.length,
      hasContent: Boolean(content?.trim()),
      failIfNotExists: failIfNotExists ?? true,
      reason: reason?.trim() || null,
    },
  });

  return { ok: true, data: result.data };
}
