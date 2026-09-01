import type { RawFile } from 'discord.js';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';

export const MAX_MESSAGE_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type MessageAttachmentError =
  | 'too_many_attachments'
  | 'attachment_too_large'
  | 'invalid_attachment';

export type PrepareMessageAttachmentsResult =
  | { ok: true; attachments: MessageAttachmentInput[]; restFiles: RawFile[] }
  | { ok: false; error: MessageAttachmentError };

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? '';
  return base.replace(/[^\w.\-()+\s]/g, '_') || 'attachment';
}

function isBuffer(value: unknown): value is Buffer {
  return Buffer.isBuffer(value);
}

/** Validate attachment inputs and convert them to Discord REST file payloads. */
export function prepareMessageAttachments(
  inputs: MessageAttachmentInput[],
): PrepareMessageAttachmentsResult {
  if (!Array.isArray(inputs)) {
    return { ok: false, error: 'invalid_attachment' };
  }
  if (inputs.length > MAX_MESSAGE_ATTACHMENTS) {
    return { ok: false, error: 'too_many_attachments' };
  }

  const attachments: MessageAttachmentInput[] = [];
  const restFiles: RawFile[] = [];

  for (const input of inputs) {
    if (!input || !isBuffer(input.data) || input.data.length === 0) {
      return { ok: false, error: 'invalid_attachment' };
    }
    if (input.data.length > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: 'attachment_too_large' };
    }

    const filename = sanitizeFilename(input.filename);
    const contentType = input.contentType?.trim() || undefined;
    const attachment: MessageAttachmentInput = {
      filename,
      data: input.data,
      contentType: contentType ?? null,
      size: input.data.length,
    };

    attachments.push(attachment);
    restFiles.push({
      name: filename,
      data: input.data,
      contentType,
    });
  }

  return { ok: true, attachments, restFiles };
}
