import { DiscordAPIError, Routes } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/deleteMessage');

export type DeleteMessageError =
  | 'bot_not_connected'
  | 'channel_not_found'
  | 'channel_not_text'
  | 'message_not_found'
  | 'missing_permission'
  | 'not_deletable';

export type DeleteMessageResult =
  | { ok: true }
  | { ok: false; error: DeleteMessageError };

function isUnknownChannel(error: unknown): boolean {
  return error instanceof DiscordAPIError && error.code === 10003;
}

function isUnknownMessage(error: unknown): boolean {
  return error instanceof DiscordAPIError && error.code === 10008;
}

function isMissingAccess(error: unknown): boolean {
  return error instanceof DiscordAPIError && (error.code === 50001 || error.code === 50013);
}

/**
 * Delete a single guild channel message by channel and message snowflake IDs.
 * @see https://docs.discord.com/developers/resources/message#delete-message
 */
export async function deleteGuildMessage(
  channelId: string,
  messageId: string,
  reason?: string,
): Promise<DeleteMessageResult> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (error) {
    if (isUnknownChannel(error) || isMissingAccess(error)) {
      return { ok: false, error: 'channel_not_found' };
    }
    logger.error(`Failed to fetch channel ${channelId}: ${String(error)}`);
    throw error;
  }

  if (!channel) {
    return { ok: false, error: 'channel_not_found' };
  }
  if (!channel.isTextBased() || channel.isDMBased()) {
    return { ok: false, error: 'channel_not_text' };
  }

  try {
    const message = await channel.messages.fetch(messageId);
    if (!message.deletable) {
      return { ok: false, error: 'not_deletable' };
    }

    const auditReason = reason?.trim();
    await client.rest.delete(Routes.channelMessage(channelId, messageId), {
      reason: auditReason || undefined,
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
      `Failed to delete message ${messageId} in ${channelId}: ${String(error)}`,
    );
    throw error;
  }
}
