import {
  ChannelType,
  DiscordAPIError,
  Routes,
  type APIMessage,
  type RESTPostAPIChannelMessageJSONBody,
} from 'discord.js';
import { buildEmbeds } from '#server/discord/buildEmbeds.js';
import { prepareMessageAttachments } from '#server/discord/messageAttachments.js';
import { getDiscordClient } from '#server/discord.js';
import type { DiscordEmbedInput } from '#server/discord/types/embedInput.js';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/replyChannelMessage');

export type ReplyChannelMessageError =
  | 'bot_not_connected'
  | 'channel_not_found'
  | 'channel_not_messageable'
  | 'message_not_found'
  | 'missing_permission'
  | 'empty_content'
  | 'too_many_embeds'
  | 'invalid_embed'
  | 'too_many_attachments'
  | 'attachment_too_large'
  | 'invalid_attachment';

export type ReplyChannelMessageInput = {
  channelId: string;
  messageId: string;
  content?: string;
  embeds?: DiscordEmbedInput[];
  attachments?: MessageAttachmentInput[];
  /** When true, the request fails if the referenced message no longer exists. */
  failIfNotExists?: boolean;
  reason?: string;
};

export type ReplyChannelMessageSuccess = {
  messageId: string;
  channelId: string;
  referencedMessageId: string;
  threadId?: string;
};

export type ReplyChannelMessageResult =
  | { ok: true; data: ReplyChannelMessageSuccess }
  | { ok: false; error: ReplyChannelMessageError };

function isUnknownChannel(error: unknown): boolean {
  return error instanceof DiscordAPIError && error.code === 10003;
}

function isUnknownMessage(error: unknown): boolean {
  return error instanceof DiscordAPIError && error.code === 10008;
}

function isMissingAccess(error: unknown): boolean {
  return error instanceof DiscordAPIError && (error.code === 50001 || error.code === 50013);
}

function normalizeContent(content: string | undefined): string | undefined {
  const trimmed = content?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isReplyableChannelType(type: ChannelType): boolean {
  return (
    type === ChannelType.GuildText ||
    type === ChannelType.GuildAnnouncement ||
    type === ChannelType.PublicThread ||
    type === ChannelType.PrivateThread ||
    type === ChannelType.AnnouncementThread
  );
}

/**
 * Reply to a specific message in a guild text channel or thread.
 *
 * @see https://docs.discord.com/developers/resources/channel#create-message
 */
export async function replyChannelMessage(
  input: ReplyChannelMessageInput,
): Promise<ReplyChannelMessageResult> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  const content = normalizeContent(input.content);
  const embedInputs = input.embeds ?? [];
  const attachmentInputs = input.attachments ?? [];
  const auditReason = input.reason?.trim() || undefined;
  const failIfNotExists = input.failIfNotExists ?? true;

  if (!content && embedInputs.length === 0 && attachmentInputs.length === 0) {
    return { ok: false, error: 'empty_content' };
  }

  const embedResult = buildEmbeds(embedInputs);
  if (!embedResult.ok) {
    return { ok: false, error: embedResult.error };
  }

  const attachmentResult = prepareMessageAttachments(attachmentInputs);
  if (!attachmentResult.ok) {
    return { ok: false, error: attachmentResult.error };
  }

  let channel;
  try {
    channel = await client.channels.fetch(input.channelId);
  } catch (error) {
    if (isUnknownChannel(error) || isMissingAccess(error)) {
      return { ok: false, error: 'channel_not_found' };
    }
    logger.error(`Failed to fetch channel ${input.channelId}: ${String(error)}`);
    throw error;
  }

  if (!channel) {
    return { ok: false, error: 'channel_not_found' };
  }
  if (channel.isDMBased() || !channel.isTextBased() || !isReplyableChannelType(channel.type)) {
    return { ok: false, error: 'channel_not_messageable' };
  }

  const embeds = embedResult.embeds;
  const restFiles = attachmentResult.restFiles;
  const messagePayload: RESTPostAPIChannelMessageJSONBody = {
    content,
    embeds: embeds.map((embed) => embed.toJSON()),
    message_reference: {
      message_id: input.messageId,
      channel_id: input.channelId,
      fail_if_not_exists: failIfNotExists,
    },
  };

  try {
    const message = (await client.rest.post(Routes.channelMessages(channel.id), {
      body: messagePayload,
      files: restFiles.length > 0 ? restFiles : undefined,
      reason: auditReason,
    })) as APIMessage;

    const isThread =
      channel.type === ChannelType.PublicThread ||
      channel.type === ChannelType.PrivateThread ||
      channel.type === ChannelType.AnnouncementThread;

    return {
      ok: true,
      data: {
        messageId: message.id,
        channelId: message.channel_id,
        referencedMessageId: input.messageId,
        threadId: isThread ? channel.id : undefined,
      },
    };
  } catch (error) {
    if (isUnknownMessage(error)) {
      return { ok: false, error: 'message_not_found' };
    }
    if (isMissingAccess(error)) {
      return { ok: false, error: 'missing_permission' };
    }
    logger.error(
      `Failed to reply to message ${input.messageId} in channel ${input.channelId}: ${String(error)}`,
    );
    throw error;
  }
}
