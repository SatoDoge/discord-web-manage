import type { DiscordEmbedInput } from '#server/discord/types/embedInput.js';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import { toStoredAttachmentMeta } from '#server/discord/types/messageAttachmentInput.js';
import { addBotPostedMessage } from '#server/stores/botPostedMessageStore.js';
import type {
  BotPostedMessage,
  BotPostedMessageSendMode,
} from '#server/types/botPostedMessage.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('services/botPostedMessage/recordBotPostedMessage');

export type RecordBotPostedMessageInput = {
  messageId: string;
  channelId: string;
  threadId?: string | null;
  sendMode: BotPostedMessageSendMode;
  referencedMessageId?: string | null;
  forumThreadName?: string | null;
  content?: string;
  embeds?: DiscordEmbedInput[];
  attachments?: MessageAttachmentInput[];
  postedByUserId: string;
  reason?: string | null;
};

function toStoredAttachments(attachments: MessageAttachmentInput[] = []) {
  return toStoredAttachmentMeta(attachments);
}

/** Persist a successfully posted bot message. Failures are logged but do not throw. */
export async function recordBotPostedMessage(
  input: RecordBotPostedMessageInput,
): Promise<BotPostedMessage | null> {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId) {
    logger.warn('DISCORD_GUILD_ID is not set; skipping bot posted message record');
    return null;
  }

  try {
    return await addBotPostedMessage({
      messageId: input.messageId,
      guildId,
      channelId: input.channelId,
      threadId: input.threadId ?? null,
      sendMode: input.sendMode,
      referencedMessageId: input.referencedMessageId ?? null,
      forumThreadName: input.forumThreadName ?? null,
      content: input.content?.trim() || null,
      embeds: input.embeds ?? [],
      attachments: toStoredAttachments(input.attachments),
      postedByUserId: input.postedByUserId,
      reason: input.reason?.trim() || null,
    });
  } catch (error) {
    logger.error(`Failed to record bot posted message ${input.messageId}: ${String(error)}`);
    return null;
  }
}
