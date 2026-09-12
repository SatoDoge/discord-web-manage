import { sendChannelMessage } from '#server/discord/sendChannelMessage.js';
import { recordBotPostedMessage } from '#server/services/botPostedMessage/recordBotPostedMessage.js';
import { invalidateSearchMessageCache } from '#server/services/discord/searchMessageService.js';
import {
  getScheduledMessage,
  loadScheduledAttachmentFiles,
  markScheduledMessageResult,
} from '#server/stores/scheduledMessageStore.js';
import type { ScheduledMessage } from '#server/types/scheduledMessage.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('services/scheduledMessage/dispatchScheduledMessage');

export type DispatchScheduledMessageResult =
  | { ok: true; data: ScheduledMessage }
  | { ok: false; status: number; error: string; data?: ScheduledMessage };

/**
 * Send a pending scheduled message now.
 * Updates store success/failure and records botPostedMessage on success.
 * Callers should cancel any node-schedule job before invoking this.
 */
export async function dispatchScheduledMessage(
  id: string,
): Promise<DispatchScheduledMessageResult> {
  const scheduled = await getScheduledMessage(id);
  if (!scheduled) {
    return { ok: false, status: 404, error: 'not_found' };
  }
  if (scheduled.success !== null) {
    return { ok: false, status: 409, error: 'already_processed', data: scheduled };
  }

  let attachments;
  try {
    attachments = await loadScheduledAttachmentFiles(id, scheduled.payload.attachments);
  } catch (error) {
    logger.error(`Failed to load attachments for ${id}: ${String(error)}`);
    const failed = await markScheduledMessageResult(id, {
      success: false,
      error: 'attachment_load_failed',
    });
    return { ok: false, status: 500, error: 'attachment_load_failed', data: failed };
  }

  const content = scheduled.payload.content ?? undefined;
  const embeds = scheduled.payload.embeds;
  const threadName = scheduled.payload.threadName ?? undefined;
  const reason = scheduled.payload.reason ?? undefined;

  const result = await sendChannelMessage({
    channelId: scheduled.destination.channelId,
    content,
    embeds,
    attachments,
    threadName,
    reason,
  });

  if (!result.ok) {
    const failed = await markScheduledMessageResult(id, {
      success: false,
      error: result.error,
    });
    logger.warn(`Scheduled message ${id} failed: ${result.error}`);
    return {
      ok: false,
      status: result.error === 'bot_not_connected' ? 503 : 400,
      error: result.error,
      data: failed,
    };
  }

  await recordBotPostedMessage({
    messageId: result.data.messageId,
    channelId: result.data.threadId ?? result.data.channelId,
    threadId: result.data.threadId ?? null,
    sendMode: 'send',
    forumThreadName: threadName?.trim() || null,
    content,
    embeds,
    attachments,
    postedByUserId: scheduled.createdByUserId,
    origin: 'scheduled',
    scheduledMessageId: id,
  });

  const sent = await markScheduledMessageResult(id, {
    success: true,
    resultingMessageId: result.data.messageId,
    error: null,
  });

  invalidateSearchMessageCache();
  logger.info(`Scheduled message ${id} sent as ${result.data.messageId}`);
  return { ok: true, data: sent };
}
