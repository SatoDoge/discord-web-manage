import type { DiscordEmbedInput } from '#server/discord/types/embedInput.js';
import type { StoredMessageAttachmentMeta } from '#server/discord/types/messageAttachmentInput.js';

/**
 * Payload shape aligned with POST /api/discord/messages/send
 * (channelId lives under destination).
 */
export type ScheduledMessagePayload = {
  content: string | null;
  embeds: DiscordEmbedInput[];
  /** Required when posting into a forum channel. */
  threadName: string | null;
  reason: string | null;
  attachments: StoredMessageAttachmentMeta[];
};

export type ScheduledMessageDestination = {
  channelId: string;
};

/**
 * A message scheduled for automatic posting.
 * `success` is null while pending, true after a successful send, false after failure.
 */
export type ScheduledMessage = {
  id: string;
  /** ISO datetime when the message should be posted. */
  scheduledAt: string;
  /** ISO datetime when a send was attempted (success or failure). */
  sentAt: string | null;
  /** null = not yet attempted. */
  success: boolean | null;
  payload: ScheduledMessagePayload;
  destination: ScheduledMessageDestination;
  /** Admin who created the schedule. */
  createdByUserId: string;
  /** Discord message id when successfully posted. */
  resultingMessageId: string | null;
  /** Last failure reason code, if any. */
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduledMessageList = ScheduledMessage[];

export type ScheduledAttachmentFile = {
  filename: string;
  contentType: string | null;
  data: Buffer;
};

export type CreateScheduledMessageInput = {
  scheduledAt: string;
  payload: Omit<ScheduledMessagePayload, 'attachments'> & {
    attachments?: StoredMessageAttachmentMeta[];
  };
  destination: ScheduledMessageDestination;
  createdByUserId: string;
  attachmentFiles?: ScheduledAttachmentFile[];
};

export type UpdateScheduledMessageInput = {
  scheduledAt?: string;
  content?: string | null;
  embeds?: DiscordEmbedInput[];
  threadName?: string | null;
  reason?: string | null;
  channelId?: string;
  /** When set, replaces stored attachment files entirely. */
  attachmentFiles?: ScheduledAttachmentFile[];
  /**
   * Clear prior attempt fields (`success` / `sentAt` / `error` / `resultingMessageId`)
   * so a failed schedule can be retried or rescheduled as pending.
   */
  reopenFailure?: boolean;
};
