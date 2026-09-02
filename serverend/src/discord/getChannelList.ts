import { ChannelType } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/getChannelList');

export type GuildChannelSummary = {
  id: string;
  name: string;
  type: ChannelType;
  parentId: string | null;
  nsfw: boolean;
};

export type GetChannelListError = 'bot_not_connected' | 'guild_not_configured' | 'guild_not_found';

export type GetChannelListResult =
  | { ok: true; data: GuildChannelSummary[] }
  | { ok: false; error: GetChannelListError };

function isTextChannel(type: ChannelType): boolean {
  return (
    type === ChannelType.GuildText ||
    type === ChannelType.GuildAnnouncement ||
    type === ChannelType.GuildForum ||
    type === ChannelType.PublicThread ||
    type === ChannelType.PrivateThread ||
    type === ChannelType.AnnouncementThread
  );
}

/** Text-based guild channels the bot can search messages in. */
export async function getGuildChannelList(
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<GetChannelListResult> {
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
    const channels = await guild.channels.fetch();
    const data = channels
      .filter((channel) => channel != null && isTextChannel(channel.type))
      .map((channel) => ({
        id: channel!.id,
        name: channel!.name,
        type: channel!.type,
        parentId: channel!.parentId,
        nsfw: 'nsfw' in channel! ? Boolean(channel!.nsfw) : false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return { ok: true, data };
  } catch (error) {
    logger.error(`Failed to fetch guild channels: ${String(error)}`);
    return { ok: false, error: 'guild_not_found' };
  }
}
