import type { Context } from 'hono';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import {
  MAX_MESSAGE_ATTACHMENTS,
  prepareMessageAttachments,
} from '#server/discord/messageAttachments.js';

export type ParsedMessageEditBody = {
  content?: unknown;
  embeds?: unknown;
  reason?: unknown;
  replaceAttachments?: unknown;
  attachments: MessageAttachmentInput[];
};

export type ParseMessageEditFormDataResult =
  | { ok: true; body: ParsedMessageEditBody }
  | {
      ok: false;
      status: number;
      error:
        | 'invalid_body'
        | 'invalid_embeds'
        | 'invalid_replace_attachments'
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

function parseBooleanField(value: FormDataEntryValue | null): unknown {
  const raw = fieldValue(value);
  if (raw === undefined) {
    return undefined;
  }
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return Symbol('invalid');
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

/** Parse multipart/form-data for bot message edit requests. */
export async function parseMessageEditFormData(
  c: Context,
): Promise<ParseMessageEditFormDataResult> {
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

  const replaceAttachmentsParsed = parseBooleanField(formData.get('replaceAttachments'));
  if (replaceAttachmentsParsed === Symbol('invalid')) {
    return { ok: false, status: 400, error: 'invalid_replace_attachments' };
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

  return {
    ok: true,
    body: {
      content: fieldValue(formData.get('content')),
      embeds: embedsParsed,
      reason: fieldValue(formData.get('reason')),
      replaceAttachments: replaceAttachmentsParsed,
      attachments: prepared.attachments,
    },
  };
}
