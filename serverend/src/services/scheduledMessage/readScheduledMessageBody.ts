import type { Context } from 'hono';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import {
  MAX_MESSAGE_ATTACHMENTS,
  prepareMessageAttachments,
} from '#server/discord/messageAttachments.js';

export type ParsedScheduledMessageBody = {
  channelId?: unknown;
  scheduledAt?: unknown;
  content?: unknown;
  embeds?: unknown;
  threadName?: unknown;
  reason?: unknown;
  attachments: MessageAttachmentInput[];
  replaceAttachments?: boolean;
};

export type ReadScheduledMessageBodyResult =
  | { ok: true; body: ParsedScheduledMessageBody }
  | {
      ok: false;
      status: number;
      error:
        | 'invalid_body'
        | 'invalid_embeds'
        | 'too_many_attachments'
        | 'attachment_too_large'
        | 'invalid_attachment';
    };

function fieldValue(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseEmbedsField(value: FormDataEntryValue | null): unknown {
  const raw = fieldValue(value);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return Symbol('invalid');
  }
}

async function readAttachment(file: File): Promise<MessageAttachmentInput | null> {
  if (!(file instanceof File) || file.size <= 0) {
    return null;
  }

  const data = Buffer.from(await file.arrayBuffer());
  if (data.length === 0) {
    return null;
  }

  return {
    filename: file.name || 'attachment',
    data,
    contentType: file.type?.trim() || null,
    size: data.length,
  };
}

async function parseMultipart(
  c: Context,
): Promise<ReadScheduledMessageBodyResult> {
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return { ok: false, status: 400, error: 'invalid_body' };
  }

  const embedsParsed = parseEmbedsField(formData.get('embeds'));
  if (embedsParsed === Symbol('invalid')) {
    return { ok: false, status: 400, error: 'invalid_embeds' };
  }

  const fileEntries = formData
    .getAll('attachments')
    .filter((entry): entry is File => entry instanceof File);

  if (fileEntries.length > MAX_MESSAGE_ATTACHMENTS) {
    return { ok: false, status: 400, error: 'too_many_attachments' };
  }

  const attachments: MessageAttachmentInput[] = [];
  for (const file of fileEntries) {
    const attachment = await readAttachment(file);
    if (!attachment) {
      return { ok: false, status: 400, error: 'invalid_attachment' };
    }
    attachments.push(attachment);
  }

  const prepared = prepareMessageAttachments(attachments);
  if (!prepared.ok) {
    return { ok: false, status: 400, error: prepared.error };
  }

  const replaceAttachmentsRaw = fieldValue(formData.get('replaceAttachments'));

  return {
    ok: true,
    body: {
      channelId: fieldValue(formData.get('channelId')),
      scheduledAt: fieldValue(formData.get('scheduledAt')),
      content: fieldValue(formData.get('content')),
      embeds: embedsParsed,
      threadName: fieldValue(formData.get('threadName')),
      reason: fieldValue(formData.get('reason')),
      attachments: prepared.attachments,
      replaceAttachments:
        replaceAttachmentsRaw === 'true' || fileEntries.length > 0,
    },
  };
}

/** Read JSON or multipart bodies for scheduled message create/update. */
export async function readScheduledMessageBody(
  c: Context,
): Promise<ReadScheduledMessageBodyResult> {
  const contentType = c.req.header('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    return parseMultipart(c);
  }

  try {
    const json = await c.req.json();
    return {
      ok: true,
      body: {
        channelId: json.channelId,
        scheduledAt: json.scheduledAt,
        content: json.content,
        embeds: json.embeds,
        threadName: json.threadName,
        reason: json.reason,
        attachments: [],
        replaceAttachments: json.replaceAttachments === true,
      },
    };
  } catch {
    return { ok: false, status: 400, error: 'invalid_body' };
  }
}
