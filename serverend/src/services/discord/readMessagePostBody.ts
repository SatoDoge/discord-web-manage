import type { Context } from 'hono';
import type { ParsedMessagePostBody } from '#server/services/discord/parseMessagePostFormData.js';
import { parseMessagePostFormData } from '#server/services/discord/parseMessagePostFormData.js';

export type ReadMessagePostBodyResult =
  | { ok: true; body: ParsedMessagePostBody }
  | { ok: false; status: number; error: string };

/** Read JSON or multipart/form-data bodies for message send/reply endpoints. */
export async function readMessagePostBody(c: Context): Promise<ReadMessagePostBodyResult> {
  const contentType = c.req.header('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    return parseMessagePostFormData(c);
  }

  try {
    const json = await c.req.json();
    return {
      ok: true,
      body: {
        channelId: json.channelId,
        messageId: json.messageId,
        content: json.content,
        embeds: json.embeds,
        threadName: json.threadName,
        reason: json.reason,
        failIfNotExists: json.failIfNotExists,
        attachments: [],
      },
    };
  } catch {
    return { ok: false, status: 400, error: 'invalid_body' };
  }
}
