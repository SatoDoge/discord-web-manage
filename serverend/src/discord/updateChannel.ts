import {
  ChannelType,
  PermissionsBitField,
  type GuildChannelEditOptions,
} from 'discord.js';
import {
  asEditableGuildChannel,
  toGuildChannelDetail,
  type GetChannelDetailError,
  type GuildChannelDetail,
} from '#server/discord/getChannelDetail.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/updateChannel');

export type UpdateGuildChannelInput = {
  name?: string;
  topic?: string | null;
  parentId?: string | null;
  nsfw?: boolean;
  rateLimitPerUser?: number;
  bitrate?: number;
  userLimit?: number;
  position?: number;
  rtcRegion?: string | null;
  reason?: string;
};

export type UpdateGuildChannelError =
  | GetChannelDetailError
  | 'missing_permission'
  | 'invalid_parent'
  | 'update_failed';

export type UpdateGuildChannelResult =
  | { ok: true; data: GuildChannelDetail }
  | { ok: false; error: UpdateGuildChannelError };

/**
 * Update guild channel properties (name, topic, category, NSFW, slowmode, voice settings, etc.).
 */
export async function updateGuildChannel(
  channelId: string,
  input: UpdateGuildChannelInput,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<UpdateGuildChannelResult> {
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

    const editOptions: GuildChannelEditOptions = {};

    if (input.name !== undefined) {
      editOptions.name = input.name.trim();
    }
    if (input.topic !== undefined) {
      editOptions.topic = input.topic;
    }
    if (input.nsfw !== undefined) {
      editOptions.nsfw = input.nsfw;
    }
    if (input.rateLimitPerUser !== undefined) {
      editOptions.rateLimitPerUser = input.rateLimitPerUser;
    }
    if (input.bitrate !== undefined) {
      editOptions.bitrate = input.bitrate;
    }
    if (input.userLimit !== undefined) {
      editOptions.userLimit = input.userLimit;
    }
    if (input.position !== undefined) {
      editOptions.position = input.position;
    }
    if (input.rtcRegion !== undefined) {
      editOptions.rtcRegion = input.rtcRegion;
    }
    if (input.parentId !== undefined) {
      if (input.parentId === null) {
        editOptions.parent = null;
      } else {
        const parent = await guild.channels.fetch(input.parentId).catch(() => null);
        if (!parent || parent.type !== ChannelType.GuildCategory) {
          return { ok: false, error: 'invalid_parent' };
        }
        editOptions.parent = parent.id;
      }
    }

    if (Object.keys(editOptions).length === 0) {
      return { ok: true, data: toGuildChannelDetail(editable) };
    }

    const updated = asEditableGuildChannel(
      await editable.edit({
        ...editOptions,
        reason: input.reason?.trim() || undefined,
      }),
    );
    if (!updated) {
      return { ok: false, error: 'channel_not_guild' };
    }

    return { ok: true, data: toGuildChannelDetail(updated) };
  } catch (error) {
    logger.error(`Failed to update channel ${channelId}: ${String(error)}`);
    return { ok: false, error: 'update_failed' };
  }
}
