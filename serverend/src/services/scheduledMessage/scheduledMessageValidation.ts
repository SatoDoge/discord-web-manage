import type { DiscordEmbedInput } from '#server/discord/types/embedInput.js';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import type { ScheduledAttachmentFile } from '#server/types/scheduledMessage.js';

const SNOWFLAKE_RE = /^\d{17,20}$/;

export function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && SNOWFLAKE_RE.test(value);
}

function isEmbedInput(value: unknown): value is DiscordEmbedInput {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function parseEmbeds(value: unknown): DiscordEmbedInput[] | null {
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

export function parseScheduledAt(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function toAttachmentFiles(
  attachments: MessageAttachmentInput[],
): ScheduledAttachmentFile[] {
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    contentType: attachment.contentType,
    data: attachment.data,
  }));
}

export function hasMessageBody(input: {
  content?: string | null;
  embeds?: DiscordEmbedInput[];
  attachmentCount: number;
}): boolean {
  return Boolean(input.content?.trim()) || (input.embeds?.length ?? 0) > 0 || input.attachmentCount > 0;
}
