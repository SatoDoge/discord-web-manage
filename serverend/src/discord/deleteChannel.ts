import { PermissionsBitField } from 'discord.js';
import {
  asEditableGuildChannel,
  toGuildChannelDetail,
  type GetChannelDetailError,
  type GuildChannelDetail,
} from '#server/discord/getChannelDetail.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/deleteChannel');

export type DeleteGuildChannelError =
  | GetChannelDetailError
  | 'missing_permission'
  | 'delete_failed';

export type DeleteGuildChannelResult =
  | { ok: true; data: GuildChannelDetail }
  | { ok: false; error: DeleteGuildChannelError };

/** Delete a guild channel (text, voice, category, forum, etc.). */
export async function deleteGuildChannel(
  channelId: string,
  reason?: string,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<DeleteGuildChannelResult> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  if (!guildId) {
    logger.error('DISCORD_GUILD_ID is not set');
    return { ok: false, error: 'guild_not_configured' };
  }

  try {
    const guild = await client.guilds.fetch(guildId);
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return { ok: false, error: 'missing_permission' };
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    const editable = asEditableGuildChannel(channel);
    if (!channel) {
      return { ok: false, error: 'channel_not_found' };
    }
    if (!editable) {
      return { ok: false, error: 'channel_not_guild' };
    }

    const snapshot = toGuildChannelDetail(editable);
    await channel.delete(reason?.trim() || undefined);
    return { ok: true, data: snapshot };
  } catch (error) {
    logger.error(`Failed to delete channel ${channelId}: ${String(error)}`);
    return { ok: false, error: 'delete_failed' };
  }
}
