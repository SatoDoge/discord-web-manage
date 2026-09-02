import {
  sendChannelMessage,
  type SendChannelMessageError,
  type SendChannelMessageSuccess,
} from '#server/discord/sendChannelMessage.js';
import type { DiscordEmbedInput } from '#server/discord/types/embedInput.js';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import { recordBotPostedMessage } from '#server/services/botPostedMessage/recordBotPostedMessage.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type { SendChannelMessageError, SendChannelMessageSuccess };

export type SendChannelMessageServiceResult =
  | { ok: true; data: SendChannelMessageSuccess }
  | {
      ok: false;
      status: number;
      error:
        | SendChannelMessageError
        | 'invalid_channel_id'
        | 'invalid_body'
        | 'invalid_embeds'
        | 'too_many_attachments'
        | 'attachment_too_large'
        | 'invalid_attachment';
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

function errorStatus(error: SendChannelMessageError): number {
  switch (error) {
    case 'bot_not_connected':
      return 503;
    case 'channel_not_found':
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
    action: 'message.send',
    category: 'message',
    targetType: 'channel',
    targetId: typeof metadata.channelId === 'string' ? metadata.channelId : null,
    success: false,
    errorMessage: error,
    summary: 'メッセージの投稿に失敗しました',
    metadata,
  });
}

/**
 * Validate input and post a message and/or embeds to a Discord channel, thread, or forum.
 */
export async function postChannelMessage(
  body: {
    channelId?: unknown;
    content?: unknown;
    embeds?: unknown;
    threadName?: unknown;
    reason?: unknown;
    attachments?: MessageAttachmentInput[];
  },
  context: AuthenticatedServiceContext,
): Promise<SendChannelMessageServiceResult> {
  if (!isSnowflake(body.channelId)) {
    recordFailure(context, 'invalid_channel_id', { channelId: body.channelId });
    return { ok: false, status: 400, error: 'invalid_channel_id' };
  }

  const embeds = parseEmbeds(body.embeds);
  if (embeds === null) {
    recordFailure(context, 'invalid_embeds', {
      channelId: body.channelId,
      embeds: body.embeds,
    });
    return { ok: false, status: 400, error: 'invalid_embeds' };
  }

  const content = typeof body.content === 'string' ? body.content : undefined;
  const threadName = typeof body.threadName === 'string' ? body.threadName : undefined;
  const reason = typeof body.reason === 'string' ? body.reason : undefined;
  const attachments = body.attachments ?? [];

  if (!content?.trim() && embeds.length === 0 && attachments.length === 0) {
    recordFailure(context, 'empty_content', {
      channelId: body.channelId,
      hasContent: Boolean(content),
      embedCount: embeds.length,
      attachmentCount: attachments.length,
    });
    return { ok: false, status: 400, error: 'empty_content' };
  }

  const result = await sendChannelMessage({
    channelId: body.channelId,
    content,
    embeds,
    attachments,
    threadName,
    reason,
  });

  if (!result.ok) {
    recordFailure(context, result.error, {
      channelId: body.channelId,
      threadName,
      embedCount: embeds.length,
      hasContent: Boolean(content?.trim()),
    });
    return {
      ok: false,
      status: errorStatus(result.error),
      error: result.error,
    };
  }

  recordAuthenticatedAdminOperation(context, {
    action: 'message.send',
    category: 'message',
    targetType: 'message',
    targetId: result.data.messageId,
    success: true,
    summary: 'メッセージを投稿しました',
    metadata: {
      channelId: body.channelId,
      messageId: result.data.messageId,
      threadId: result.data.threadId ?? null,
      threadName: threadName?.trim() || null,
      embedCount: embeds.length,
      hasContent: Boolean(content?.trim()),
      attachmentCount: attachments.length,
      reason: reason?.trim() || null,
    },
  });

  await recordBotPostedMessage({
    messageId: result.data.messageId,
    channelId: result.data.threadId ?? result.data.channelId,
    threadId: result.data.threadId ?? null,
    sendMode: 'send',
    forumThreadName: threadName?.trim() || null,
    content,
    embeds,
    attachments,
    postedByUserId: context.actorUserId,
    reason,
  });

  return { ok: true, data: result.data };
}
