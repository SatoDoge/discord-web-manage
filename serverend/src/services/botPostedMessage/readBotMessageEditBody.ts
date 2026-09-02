import type { Context } from 'hono';
import type { ParsedMessageEditBody } from '#server/services/botPostedMessage/parseMessageEditFormData.js';
import { parseMessageEditFormData } from '#server/services/botPostedMessage/parseMessageEditFormData.js';

export type ReadBotMessageEditBodyResult =
  | { ok: true; body: ParsedMessageEditBody }
  | { ok: false; status: number; error: string };

/** Read JSON or multipart/form-data bodies for bot message edit endpoints. */
export async function readBotMessageEditBody(
  c: Context,
): Promise<ReadBotMessageEditBodyResult> {
  const contentType = c.req.header('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    return parseMessageEditFormData(c);
  }

  try {
    const json = await c.req.json();
    return {
      ok: true,
      body: {
        content: json.content,
        embeds: json.embeds,
        reason: json.reason,
        replaceAttachments: json.replaceAttachments,
        attachments: [],
      },
    };
  } catch {
    return { ok: false, status: 400, error: 'invalid_body' };
  }
}
