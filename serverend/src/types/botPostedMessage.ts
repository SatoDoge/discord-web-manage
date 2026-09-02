import type { DiscordEmbedInput } from '#server/discord/types/embedInput.js';
import type { StoredMessageAttachmentMeta } from '#server/discord/types/messageAttachmentInput.js';

export type BotPostedMessageSendMode = 'send' | 'reply';

/** A message posted by the bot through the web management API. */
export type BotPostedMessage = {
  /** Discord message snowflake (primary key). */
  messageId: string;

  guildId: string;
  channelId: string;
  threadId: string | null;

  sendMode: BotPostedMessageSendMode;
  referencedMessageId: string | null;
  forumThreadName: string | null;

  content: string | null;
  embeds: DiscordEmbedInput[];
  attachments: StoredMessageAttachmentMeta[];

  /** Admin user id who triggered the post via the web UI. */
  postedByUserId: string;
  reason: string | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
};

export type BotPostedMessageList = BotPostedMessage[];

export type CreateBotPostedMessageInput = Omit<
  BotPostedMessage,
  'createdAt' | 'updatedAt' | 'deletedAt' | 'isDeleted'
>;

export type UpdateBotPostedMessageInput = {
  content?: string | null;
  embeds?: DiscordEmbedInput[];
  attachments?: StoredMessageAttachmentMeta[];
  reason?: string | null;
};
