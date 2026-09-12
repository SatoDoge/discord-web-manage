import {
  ChannelType,
  PermissionsBitField,
  type GuildChannelCreateOptions,
} from 'discord.js';
import {
  asEditableGuildChannel,
  toGuildChannelDetail,
  type GetChannelDetailError,
  type GuildChannelDetail,
} from '#server/discord/getChannelDetail.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/createChannel');

/** Channel types that can be created via the guild channel create API. */
export const CREATABLE_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
] as const;

export type CreatableChannelType = (typeof CREATABLE_CHANNEL_TYPES)[number];

export type CreateGuildChannelInput = {
  name: string;
  type: CreatableChannelType;
  /** Category channel ID. Ignored / invalid for categories themselves. */
  parentId?: string | null;
  topic?: string | null;
  nsfw?: boolean;
  rateLimitPerUser?: number;
  bitrate?: number;
  userLimit?: number;
  position?: number;
  reason?: string;
};

export type CreateGuildChannelError =
  | GetChannelDetailError
  | 'missing_permission'
  | 'invalid_parent'
  | 'parent_not_allowed'
  | 'create_failed';

export type CreateGuildChannelResult =
  | { ok: true; data: GuildChannelDetail }
  | { ok: false; error: CreateGuildChannelError };

export function isCreatableChannelType(value: number): value is CreatableChannelType {
  return (CREATABLE_CHANNEL_TYPES as readonly number[]).includes(value);
}

/**
 * Create a guild channel (text, voice, category, announcement, stage, or forum).
 * Non-category channels may optionally belong to a category via `parentId`.
 */
export async function createGuildChannel(
  input: CreateGuildChannelInput,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<CreateGuildChannelResult> {
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

    if (input.type === ChannelType.GuildCategory && input.parentId) {
      return { ok: false, error: 'parent_not_allowed' };
    }

    const createOptions: GuildChannelCreateOptions = {
      name: input.name.trim(),
      type: input.type,
      reason: input.reason?.trim() || undefined,
    };

    if (input.topic !== undefined && input.topic !== null) {
      createOptions.topic = input.topic;
    }
    if (input.nsfw !== undefined) {
      createOptions.nsfw = input.nsfw;
    }
    if (input.rateLimitPerUser !== undefined) {
      createOptions.rateLimitPerUser = input.rateLimitPerUser;
    }
    if (input.bitrate !== undefined) {
      createOptions.bitrate = input.bitrate;
    }
    if (input.userLimit !== undefined) {
      createOptions.userLimit = input.userLimit;
    }
    if (input.position !== undefined) {
      createOptions.position = input.position;
    }

    if (input.parentId) {
      const parent = await guild.channels.fetch(input.parentId).catch(() => null);
      if (!parent || parent.type !== ChannelType.GuildCategory) {
        return { ok: false, error: 'invalid_parent' };
      }
      createOptions.parent = parent.id;
    }

    const created = await guild.channels.create(createOptions);
    const editable = asEditableGuildChannel(created);
    if (!editable) {
      return { ok: false, error: 'channel_not_guild' };
    }

    return { ok: true, data: toGuildChannelDetail(editable) };
  } catch (error) {
    logger.error(`Failed to create channel "${input.name}": ${String(error)}`);
    return { ok: false, error: 'create_failed' };
  }
}
