import {
  addScheduledMessage,
} from '#server/stores/scheduledMessageStore.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import type { ScheduledMessage } from '#server/types/scheduledMessage.js';
import {
  hasMessageBody,
  isSnowflake,
  parseEmbeds,
  parseScheduledAt,
  toAttachmentFiles,
} from '#server/services/scheduledMessage/scheduledMessageValidation.js';
import { scheduleScheduledMessageJob } from '#server/services/scheduledMessage/scheduledMessageScheduler.js';

export type CreateScheduledMessageResult =
  | { ok: true; data: ScheduledMessage }
  | {
      ok: false;
      status: number;
      error:
        | 'invalid_channel_id'
        | 'invalid_scheduled_at'
        | 'scheduled_at_in_past'
        | 'invalid_embeds'
        | 'empty_content';
    };

/**
 * Create a new scheduled message and register a node-schedule job.
 */
export async function createScheduledMessage(
  body: {
    channelId?: unknown;
    scheduledAt?: unknown;
    content?: unknown;
    embeds?: unknown;
    threadName?: unknown;
    reason?: unknown;
    attachments?: MessageAttachmentInput[];
  },
  context: AuthenticatedServiceContext,
): Promise<CreateScheduledMessageResult> {
  if (!isSnowflake(body.channelId)) {
    return { ok: false, status: 400, error: 'invalid_channel_id' };
  }

  const scheduledAt = parseScheduledAt(body.scheduledAt);
  if (!scheduledAt) {
    return { ok: false, status: 400, error: 'invalid_scheduled_at' };
  }
  if (new Date(scheduledAt).getTime() <= Date.now()) {
    return { ok: false, status: 400, error: 'scheduled_at_in_past' };
  }

  const embeds = parseEmbeds(body.embeds);
  if (embeds === null) {
    return { ok: false, status: 400, error: 'invalid_embeds' };
  }

  const content = typeof body.content === 'string' ? body.content : null;
  const threadName = typeof body.threadName === 'string' ? body.threadName.trim() || null : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null;
  const attachments = body.attachments ?? [];

  if (!hasMessageBody({ content, embeds, attachmentCount: attachments.length })) {
    return { ok: false, status: 400, error: 'empty_content' };
  }

  const message = await addScheduledMessage({
    scheduledAt,
    destination: { channelId: body.channelId },
    createdByUserId: context.actorUserId,
    payload: {
      content: content?.trim() || null,
      embeds,
      threadName,
      reason,
    },
    attachmentFiles: toAttachmentFiles(attachments),
  });

  scheduleScheduledMessageJob(message.id, message.scheduledAt);
  return { ok: true, data: message };
}
