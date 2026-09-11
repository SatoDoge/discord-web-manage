import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import {
  getScheduledMessage,
  updateScheduledMessage,
} from '#server/stores/scheduledMessageStore.js';
import type { ScheduledMessage } from '#server/types/scheduledMessage.js';
import {
  hasMessageBody,
  isSnowflake,
  parseEmbeds,
  parseScheduledAt,
  toAttachmentFiles,
} from '#server/services/scheduledMessage/scheduledMessageValidation.js';
import {
  cancelScheduledMessageJob,
  scheduleScheduledMessageJob,
} from '#server/services/scheduledMessage/scheduledMessageScheduler.js';

export type UpdateScheduledMessageResult =
  | { ok: true; data: ScheduledMessage }
  | {
      ok: false;
      status: number;
      error:
        | 'not_found'
        | 'already_processed'
        | 'invalid_channel_id'
        | 'invalid_scheduled_at'
        | 'scheduled_at_in_past'
        | 'invalid_embeds'
        | 'empty_content';
    };

/**
 * Edit a pending scheduled message. Reschedules the job when scheduledAt changes.
 */
export async function updatePendingScheduledMessage(
  id: string,
  body: {
    channelId?: unknown;
    scheduledAt?: unknown;
    content?: unknown;
    embeds?: unknown;
    threadName?: unknown;
    reason?: unknown;
    attachments?: MessageAttachmentInput[];
    /** When true and attachments is provided (including empty), replace files. */
    replaceAttachments?: boolean;
  },
): Promise<UpdateScheduledMessageResult> {
  const existing = await getScheduledMessage(id);
  if (!existing) {
    return { ok: false, status: 404, error: 'not_found' };
  }
  if (existing.success !== null) {
    return { ok: false, status: 409, error: 'already_processed' };
  }

  let scheduledAt: string | undefined;
  if (body.scheduledAt !== undefined) {
    const parsed = parseScheduledAt(body.scheduledAt);
    if (!parsed) {
      return { ok: false, status: 400, error: 'invalid_scheduled_at' };
    }
    if (new Date(parsed).getTime() <= Date.now()) {
      return { ok: false, status: 400, error: 'scheduled_at_in_past' };
    }
    scheduledAt = parsed;
  }

  let channelId: string | undefined;
  if (body.channelId !== undefined) {
    if (!isSnowflake(body.channelId)) {
      return { ok: false, status: 400, error: 'invalid_channel_id' };
    }
    channelId = body.channelId;
  }

  let embeds = existing.payload.embeds;
  if (body.embeds !== undefined) {
    const parsed = parseEmbeds(body.embeds);
    if (parsed === null) {
      return { ok: false, status: 400, error: 'invalid_embeds' };
    }
    embeds = parsed;
  }

  const content =
    body.content !== undefined
      ? typeof body.content === 'string'
        ? body.content.trim() || null
        : null
      : existing.payload.content;

  const threadName =
    body.threadName !== undefined
      ? typeof body.threadName === 'string'
        ? body.threadName.trim() || null
        : null
      : existing.payload.threadName;

  const reason =
    body.reason !== undefined
      ? typeof body.reason === 'string'
        ? body.reason.trim() || null
        : null
      : existing.payload.reason;

  const replaceAttachments = body.replaceAttachments === true;
  const nextAttachmentCount = replaceAttachments
    ? (body.attachments?.length ?? 0)
    : existing.payload.attachments.length;

  if (
    !hasMessageBody({
      content,
      embeds,
      attachmentCount: nextAttachmentCount,
    })
  ) {
    return { ok: false, status: 400, error: 'empty_content' };
  }

  const updated = await updateScheduledMessage(id, {
    scheduledAt,
    channelId,
    content,
    embeds,
    threadName,
    reason,
    attachmentFiles: replaceAttachments
      ? toAttachmentFiles(body.attachments ?? [])
      : undefined,
  });

  cancelScheduledMessageJob(id);
  scheduleScheduledMessageJob(updated.id, updated.scheduledAt);

  return { ok: true, data: updated };
}
