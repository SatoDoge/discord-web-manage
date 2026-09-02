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

const logger = new Logger('discord/sendChannelMessage');

export type SendChannelMessageError =
  | 'bot_not_connected'
  | 'channel_not_found'
  | 'channel_not_messageable'
  | 'missing_permission'
  | 'empty_content'
  | 'too_many_embeds'
  | 'invalid_embed'
  | 'thread_name_required'
  | 'invalid_thread_name'
  | 'too_many_attachments'
  | 'attachment_too_large'
  | 'invalid_attachment';

export type SendChannelMessageInput = {
  channelId: string;
  content?: string;
  embeds?: DiscordEmbedInput[];
  attachments?: MessageAttachmentInput[];
  /** Required when posting a new thread in a forum channel. */
  threadName?: string;
  reason?: string;
};

export type SendChannelMessageSuccess = {
  messageId: string;
  channelId: string;
  threadId?: string;
};

export type SendChannelMessageResult =
  | { ok: true; data: SendChannelMessageSuccess }
  | { ok: false; error: SendChannelMessageError };

function isUnknownChannel(error: unknown): boolean {
  return error instanceof DiscordAPIError && error.code === 10003;
}

function isMissingAccess(error: unknown): boolean {
  return error instanceof DiscordAPIError && (error.code === 50001 || error.code === 50013);
}

function normalizeContent(content: string | undefined): string | undefined {
  const trimmed = content?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function toAttachmentPayloads(attachments: MessageAttachmentInput[]) {
  return attachments.map((file) => ({
    attachment: file.data,
    name: file.filename,
  }));
}

function normalizeThreadName(threadName: string | undefined): string | undefined {
  const trimmed = threadName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Post a message and/or embeds to a guild text channel, thread, or forum channel.
 * For forum channels, provide `threadName` to create a new forum post.
 *
 * @see https://docs.discord.com/developers/resources/channel#create-message
 * @see https://docs.discord.com/developers/resources/channel#start-thread-in-forum-or-media-channel
 */
export async function sendChannelMessage(
  input: SendChannelMessageInput,
): Promise<SendChannelMessageResult> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  const content = normalizeContent(input.content);
  const embedInputs = input.embeds ?? [];
  const attachmentInputs = input.attachments ?? [];
  const threadName = normalizeThreadName(input.threadName);
  const auditReason = input.reason?.trim() || undefined;

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
  if (channel.isDMBased()) {
    return { ok: false, error: 'channel_not_messageable' };
  }

  const embeds = embedResult.embeds;
  const restFiles = attachmentResult.restFiles;
  const messagePayload: RESTPostAPIChannelMessageJSONBody = {
    content,
    embeds: embeds.map((embed) => embed.toJSON()),
  };

  try {
    if (channel.type === ChannelType.GuildForum) {
      if (!threadName) {
        return { ok: false, error: 'thread_name_required' };
      }
      if (threadName.length > 100) {
        return { ok: false, error: 'invalid_thread_name' };
      }

      const thread = await channel.threads.create({
        name: threadName,
        message: {
          content,
          embeds,
          files: toAttachmentPayloads(attachmentResult.attachments),
        },
        reason: auditReason,
      });

      const starterMessage = thread.lastMessage ?? (await thread.fetchStarterMessage());
      if (!starterMessage) {
        logger.error(`Forum thread ${thread.id} was created without a starter message`);
        return {
          ok: true,
          data: {
            messageId: thread.id,
            channelId: input.channelId,
            threadId: thread.id,
          },
        };
      }

      return {
        ok: true,
        data: {
          messageId: starterMessage.id,
          channelId: input.channelId,
          threadId: thread.id,
        },
      };
    }

    if (!channel.isTextBased()) {
      return { ok: false, error: 'channel_not_messageable' };
    }

    switch (channel.type) {
      case ChannelType.GuildText:
      case ChannelType.GuildAnnouncement:
      case ChannelType.PublicThread:
      case ChannelType.PrivateThread:
      case ChannelType.AnnouncementThread: {
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
            threadId: isThread ? channel.id : undefined,
          },
        };
      }
      default:
        return { ok: false, error: 'channel_not_messageable' };
    }
  } catch (error) {
    if (isMissingAccess(error)) {
      return { ok: false, error: 'missing_permission' };
    }
    logger.error(
      `Failed to send message to channel ${input.channelId}: ${String(error)}`,
    );
    throw error;
  }
}
