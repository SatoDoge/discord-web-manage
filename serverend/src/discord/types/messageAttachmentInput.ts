/** Attachment payload for Discord message create/edit APIs. */
export type MessageAttachmentInput = {
  filename: string;
  data: Buffer;
  contentType: string | null;
  size: number;
};

/** Stored metadata for attachments posted through the web UI. */
export type StoredMessageAttachmentMeta = {
  filename: string;
  contentType: string | null;
  size: number;
};

/** Convert upload payloads to stored attachment metadata. */
export function toStoredAttachmentMeta(
  attachments: MessageAttachmentInput[] = [],
): StoredMessageAttachmentMeta[] {
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    contentType: attachment.contentType,
    size: attachment.size,
  }));
}
