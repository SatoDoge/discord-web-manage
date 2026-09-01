import {
  ChannelType,
  DiscordAPIError,
  Routes,
  type RESTPatchAPIChannelMessageJSONBody,
} from 'discord.js';
import { buildEmbeds } from '#server/discord/buildEmbeds.js';
import { getDiscordClient } from '#server/discord.js';
import {
  prepareMessageAttachments,
  type MessageAttachmentError,
} from '#server/discord/messageAttachments.js';
import type { DiscordEmbedInput } from '#server/discord/types/embedInput.js';
import type { MessageAttachmentInput } from '#server/discord/types/messageAttachmentInput.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/editChannelMessage');

export type EditChannelMessageError =
  | 'bot_not_connected'
  | 'channel_not_found'
  | 'channel_not_messageable'
  | 'message_not_found'
  | 'missing_permission'
  | 'empty_content'
  | 'too_many_embeds'
  | 'invalid_embed'
  | MessageAttachmentError;

export type EditChannelMessageInput = {
  channelId: string;
  messageId: string;
  content?: string;
  embeds?: DiscordEmbedInput[];
  /** When true, existing Discord attachments are cleared and replaced with `attachments`. */
  replaceAttachments?: boolean;
  attachments?: MessageAttachmentInput[];
  reason?: string;
};

export type EditChannelMessageResult =
  | { ok: true }
  | { ok: false; error: EditChannelMessageError };

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

function isEditableChannelType(type: ChannelType): boolean {
  return (
    type === ChannelType.GuildText ||
    type === ChannelType.GuildAnnouncement ||
    type === ChannelType.PublicThread ||
    type === ChannelType.PrivateThread ||
    type === ChannelType.AnnouncementThread
  );
}

/**
 * Edit a bot message in a guild text channel or thread.
 *
 * @see https://docs.discord.com/developers/resources/channel#edit-message
 */
export async function editChannelMessage(
  input: EditChannelMessageInput,
): Promise<EditChannelMessageResult> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  const content = normalizeContent(input.content);
  const embedInputs = input.embeds ?? [];
  const auditReason = input.reason?.trim() || undefined;
  const replaceAttachments = input.replaceAttachments === true;
  const attachmentInputs = replaceAttachments ? (input.attachments ?? []) : [];

  if (!content && embedInputs.length === 0 && !replaceAttachments) {
    return { ok: false, error: 'empty_content' };
  }
  if (
    !content &&
    embedInputs.length === 0 &&
    replaceAttachments &&
    attachmentInputs.length === 0
  ) {
    return { ok: false, error: 'empty_content' };
  }

  const embedResult = buildEmbeds(embedInputs);
  if (!embedResult.ok) {
    return { ok: false, error: embedResult.error };
  }

  const attachmentResult = replaceAttachments
    ? prepareMessageAttachments(attachmentInputs)
    : null;
  if (attachmentResult && !attachmentResult.ok) {
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
  if (channel.isDMBased() || !channel.isTextBased() || !isEditableChannelType(channel.type)) {
    return { ok: false, error: 'channel_not_messageable' };
  }

  const messagePayload: RESTPatchAPIChannelMessageJSONBody = {
    content,
    embeds: embedResult.embeds.map((embed) => embed.toJSON()),
  };
  if (replaceAttachments) {
    messagePayload.attachments = [];
  }

  const restFiles =
    attachmentResult && attachmentResult.restFiles.length > 0
      ? attachmentResult.restFiles
      : undefined;

  try {
    await client.rest.patch(Routes.channelMessage(channel.id, input.messageId), {
      body: messagePayload,
      files: restFiles,
      reason: auditReason,
    });
    return { ok: true };
  } catch (error) {
    if (isUnknownMessage(error)) {
      return { ok: false, error: 'message_not_found' };
    }
    if (isMissingAccess(error)) {
      return { ok: false, error: 'missing_permission' };
    }
    logger.error(
      `Failed to edit message ${input.messageId} in channel ${input.channelId}: ${String(error)}`,
    );
    throw error;
  }
}
