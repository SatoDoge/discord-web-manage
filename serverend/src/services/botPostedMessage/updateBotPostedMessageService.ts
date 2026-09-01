import {
  editChannelMessage,
  type EditChannelMessageError,
} from '#server/discord/editChannelMessage.js';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import { toStoredAttachmentMeta } from '#server/discord/types/messageAttachmentInput.js';
import {
  getBotPostedMessage,
  updateBotPostedMessage,
} from '#server/stores/botPostedMessageStore.js';
import { parseEmbeds, isSnowflake } from '#server/services/botPostedMessage/embedValidation.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { BotPostedMessage } from '#server/types/botPostedMessage.js';

export type UpdateBotPostedMessageServiceResult =
  | { ok: true; data: BotPostedMessage }
  | {
      ok: false;
      status: number;
      error:
        | EditChannelMessageError
        | 'invalid_message_id'
        | 'invalid_embeds'
        | 'invalid_replace_attachments'
        | 'message_not_found'
        | 'already_deleted';
    };

function errorStatus(error: EditChannelMessageError | 'already_deleted'): number {
  switch (error) {
    case 'bot_not_connected':
      return 503;
    case 'channel_not_found':
    case 'message_not_found':
      return 404;
    case 'channel_not_messageable':
    case 'missing_permission':
    case 'already_deleted':
      return 403;
    default:
      return 400;
  }
}

function parseReplaceAttachments(value: unknown): boolean | null {
  if (value === undefined) {
    return false;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return null;
}

/**
 * Edit a bot-posted message on Discord and update the local record.
 */
export async function updateStoredBotPostedMessage(
  messageId: unknown,
  body: {
    content?: unknown;
    embeds?: unknown;
    reason?: unknown;
    replaceAttachments?: unknown;
    attachments?: MessageAttachmentInput[];
  },
  context: AuthenticatedServiceContext,
): Promise<UpdateBotPostedMessageServiceResult> {
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

  const embeds = parseEmbeds(body.embeds);
  if (embeds === null) {
    return { ok: false, status: 400, error: 'invalid_embeds' };
  }

  const replaceAttachments = parseReplaceAttachments(body.replaceAttachments);
  if (replaceAttachments === null) {
    return { ok: false, status: 400, error: 'invalid_replace_attachments' };
  }

  const content = typeof body.content === 'string' ? body.content : undefined;
  const reason = typeof body.reason === 'string' ? body.reason : undefined;
  const nextContent = content !== undefined ? content.trim() : stored.content ?? '';
  const nextEmbeds = body.embeds !== undefined ? embeds : stored.embeds;
  const nextAttachments = replaceAttachments
    ? toStoredAttachmentMeta(body.attachments ?? [])
    : stored.attachments;

  if (!nextContent && nextEmbeds.length === 0 && !replaceAttachments) {
    return { ok: false, status: 400, error: 'empty_content' };
  }
  if (!nextContent && nextEmbeds.length === 0 && replaceAttachments && nextAttachments.length === 0) {
    return { ok: false, status: 400, error: 'empty_content' };
  }

  const result = await editChannelMessage({
    channelId: stored.channelId,
    messageId: stored.messageId,
    content: nextContent || undefined,
    embeds: nextEmbeds,
    replaceAttachments,
    attachments: replaceAttachments ? (body.attachments ?? []) : undefined,
    reason,
  });

  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'bot_message.update',
      category: 'message',
      targetType: 'message',
      targetId: stored.messageId,
      success: false,
      errorMessage: result.error,
      summary: 'Bot投稿メッセージの編集に失敗しました',
      metadata: { channelId: stored.channelId },
    });
    return {
      ok: false,
      status: errorStatus(result.error),
      error: result.error,
    };
  }

  const updated = await updateBotPostedMessage(stored.messageId, {
    content: nextContent || null,
    embeds: nextEmbeds,
    attachments: nextAttachments,
    reason: reason?.trim() || stored.reason,
  });

  recordAuthenticatedAdminOperation(context, {
    action: 'bot_message.update',
    category: 'message',
    targetType: 'message',
    targetId: stored.messageId,
    success: true,
    summary: 'Bot投稿メッセージを編集しました',
    metadata: {
      channelId: stored.channelId,
      embedCount: nextEmbeds.length,
      hasContent: Boolean(nextContent),
      attachmentCount: nextAttachments.length,
      replacedAttachments: replaceAttachments,
    },
  });

  return { ok: true, data: updated };
}
