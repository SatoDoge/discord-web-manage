import {
  ChannelType,
  OverwriteType,
  PermissionsBitField,
  type CategoryChannel,
  type GuildBasedChannel,
  type PermissionOverwriteManager,
  type PermissionOverwriteOptions,
  type PermissionOverwrites,
} from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/channelDetail');

export type ChannelParentSummary = {
  id: string;
  name: string;
  type: ChannelType;
};

export type ChannelPermissionOverwrite = {
  id: string;
  type: OverwriteType;
  allow: string[];
  deny: string[];
  allowBitfield: string;
  denyBitfield: string;
};

export type GuildChannelDetail = {
  id: string;
  name: string;
  type: ChannelType;
  guildId: string;
  parentId: string | null;
  parent: ChannelParentSummary | null;
  position: number;
  rawPosition: number;
  nsfw: boolean | null;
  topic: string | null;
  rateLimitPerUser: number | null;
  bitrate: number | null;
  userLimit: number | null;
  rtcRegion: string | null;
  videoQualityMode: number | null;
  defaultAutoArchiveDuration: number | null;
  availableTags: Array<{
    id: string;
    name: string;
    moderated: boolean;
    emojiId: string | null;
    emojiName: string | null;
  }> | null;
  permissionOverwrites: ChannelPermissionOverwrite[];
};

export type GetChannelDetailError =
  | 'bot_not_connected'
  | 'guild_not_configured'
  | 'guild_not_found'
  | 'channel_not_found'
  | 'channel_not_guild';

export type GetChannelDetailResult =
  | { ok: true; data: GuildChannelDetail }
  | { ok: false; error: GetChannelDetailError };

/** Guild channels that support permission overwrites (excludes threads). */
export type EditableGuildChannel = GuildBasedChannel & {
  guildId: string;
  parentId: string | null;
  parent: CategoryChannel | null;
  position: number;
  rawPosition: number;
  permissionOverwrites: PermissionOverwriteManager;
  edit: (options: Record<string, unknown>) => Promise<GuildBasedChannel>;
  fetch: (force?: boolean) => Promise<GuildBasedChannel>;
};

function toPermissionFlags(bitfield: PermissionsBitField | bigint): string[] {
  return new PermissionsBitField(bitfield).toArray();
}

function toOverwrite(overwrite: PermissionOverwrites): ChannelPermissionOverwrite {
  return {
    id: overwrite.id,
    type: overwrite.type,
    allow: toPermissionFlags(overwrite.allow),
    deny: toPermissionFlags(overwrite.deny),
    allowBitfield: overwrite.allow.bitfield.toString(),
    denyBitfield: overwrite.deny.bitfield.toString(),
  };
}

function toParentSummary(parent: CategoryChannel | null): ChannelParentSummary | null {
  if (!parent) {
    return null;
  }
  return {
    id: parent.id,
    name: parent.name,
    type: parent.type,
  };
}

export function asEditableGuildChannel(channel: GuildBasedChannel | null): EditableGuildChannel | null {
  if (!channel || !('permissionOverwrites' in channel)) {
    return null;
  }
  return channel as EditableGuildChannel;
}

function channelProperty(channel: EditableGuildChannel, key: string): unknown {
  return Reflect.get(channel, key);
}

function readOptionalString(channel: EditableGuildChannel, key: string): string | null {
  const value = channelProperty(channel, key);
  return typeof value === 'string' ? value : null;
}

function readOptionalNumber(channel: EditableGuildChannel, key: string): number | null {
  const value = channelProperty(channel, key);
  return typeof value === 'number' ? value : null;
}

function readOptionalBoolean(channel: EditableGuildChannel, key: string): boolean | null {
  const value = channelProperty(channel, key);
  return typeof value === 'boolean' ? value : null;
}

export function toGuildChannelDetail(channel: EditableGuildChannel): GuildChannelDetail {
  const parent =
    channel.parent && channel.parent.type === ChannelType.GuildCategory
      ? toParentSummary(channel.parent)
      : null;

  const availableTagsRaw = channelProperty(channel, 'availableTags');
  const availableTags = Array.isArray(availableTagsRaw)
    ? availableTagsRaw.map((tag) => {
        const entry = tag as {
          id: string;
          name: string;
          moderated: boolean;
          emoji?: { id: string | null; name: string | null } | null;
        };
        return {
          id: entry.id,
          name: entry.name,
          moderated: entry.moderated,
          emojiId: entry.emoji?.id ?? null,
          emojiName: entry.emoji?.name ?? null,
        };
      })
    : null;

  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    guildId: channel.guildId,
    parentId: channel.parentId,
    parent,
    position: channel.position,
    rawPosition: channel.rawPosition,
    nsfw: readOptionalBoolean(channel, 'nsfw'),
    topic: readOptionalString(channel, 'topic'),
    rateLimitPerUser: readOptionalNumber(channel, 'rateLimitPerUser'),
    bitrate: readOptionalNumber(channel, 'bitrate'),
    userLimit: readOptionalNumber(channel, 'userLimit'),
    rtcRegion: readOptionalString(channel, 'rtcRegion'),
    videoQualityMode: readOptionalNumber(channel, 'videoQualityMode'),
    defaultAutoArchiveDuration: readOptionalNumber(channel, 'defaultAutoArchiveDuration'),
    availableTags,
    permissionOverwrites: [...channel.permissionOverwrites.cache.values()]
      .map((overwrite) => toOverwrite(overwrite))
      .sort((a, b) => a.type - b.type || a.id.localeCompare(b.id)),
  };
}

export async function getGuildChannelDetail(
  channelId: string,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<GetChannelDetailResult> {
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
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    const editable = asEditableGuildChannel(channel);
    if (!channel) {
      return { ok: false, error: 'channel_not_found' };
    }
    if (!editable) {
      return { ok: false, error: 'channel_not_guild' };
    }

    return { ok: true, data: toGuildChannelDetail(editable) };
  } catch (error) {
    logger.error(`Failed to fetch channel ${channelId}: ${String(error)}`);
    return { ok: false, error: 'guild_not_found' };
  }
}

export type PermissionFlagValue = boolean | null;

export type ChannelPermissionUpdateInput = {
  /** true = allow, false = deny, null = inherit (unset) */
  permissions?: Record<string, PermissionFlagValue>;
  allow?: string[];
  deny?: string[];
  type?: OverwriteType;
  reason?: string;
};

export type UpdateChannelPermissionError =
  | GetChannelDetailError
  | 'invalid_permission'
  | 'invalid_overwrite_type'
  | 'missing_permission'
  | 'update_failed';

export type UpdateChannelPermissionResult =
  | { ok: true; data: GuildChannelDetail }
  | { ok: false; error: UpdateChannelPermissionError };

const VALID_PERMISSION_FLAGS = new Set(Object.keys(PermissionsBitField.Flags));

function buildOverwriteOptions(
  input: ChannelPermissionUpdateInput,
): { ok: true; options: PermissionOverwriteOptions } | { ok: false; error: 'invalid_permission' } {
  const options: PermissionOverwriteOptions = {};

  if (input.permissions) {
    for (const [flag, value] of Object.entries(input.permissions)) {
      if (!VALID_PERMISSION_FLAGS.has(flag)) {
        return { ok: false, error: 'invalid_permission' };
      }
      if (value !== true && value !== false && value !== null) {
        return { ok: false, error: 'invalid_permission' };
      }
      options[flag as keyof PermissionOverwriteOptions] = value;
    }
  }

  if (input.allow) {
    for (const flag of input.allow) {
      if (!VALID_PERMISSION_FLAGS.has(flag)) {
        return { ok: false, error: 'invalid_permission' };
      }
      options[flag as keyof PermissionOverwriteOptions] = true;
    }
  }

  if (input.deny) {
    for (const flag of input.deny) {
      if (!VALID_PERMISSION_FLAGS.has(flag)) {
        return { ok: false, error: 'invalid_permission' };
      }
      options[flag as keyof PermissionOverwriteOptions] = false;
    }
  }

  return { ok: true, options };
}

async function fetchEditableGuildChannel(
  channelId: string,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<
  | { ok: true; channel: EditableGuildChannel }
  | { ok: false; error: GetChannelDetailError | 'missing_permission' }
> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    return { ok: false, error: 'bot_not_connected' };
  }
  if (!guildId) {
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

    return { ok: true, channel: editable };
  } catch (error) {
    logger.error(`Failed to load channel ${channelId}: ${String(error)}`);
    return { ok: false, error: 'guild_not_found' };
  }
}

export async function updateGuildChannelPermission(
  channelId: string,
  overwriteId: string,
  input: ChannelPermissionUpdateInput,
): Promise<UpdateChannelPermissionResult> {
  const loaded = await fetchEditableGuildChannel(channelId);
  if (!loaded.ok) {
    return loaded;
  }

  if (
    input.type !== undefined &&
    input.type !== OverwriteType.Role &&
    input.type !== OverwriteType.Member
  ) {
    return { ok: false, error: 'invalid_overwrite_type' };
  }

  const built = buildOverwriteOptions(input);
  if (!built.ok) {
    return built;
  }

  try {
    await loaded.channel.permissionOverwrites.edit(overwriteId, built.options, {
      type: input.type,
      reason: input.reason?.trim() || undefined,
    });
    const refreshed = asEditableGuildChannel(await loaded.channel.fetch());
    if (!refreshed) {
      return { ok: false, error: 'channel_not_guild' };
    }
    return { ok: true, data: toGuildChannelDetail(refreshed) };
  } catch (error) {
    logger.error(
      `Failed to update permission overwrite ${overwriteId} on ${channelId}: ${String(error)}`,
    );
    return { ok: false, error: 'update_failed' };
  }
}

export type DeleteChannelPermissionResult =
  | { ok: true; data: GuildChannelDetail }
  | {
      ok: false;
      error: GetChannelDetailError | 'missing_permission' | 'overwrite_not_found' | 'delete_failed';
    };

export async function deleteGuildChannelPermission(
  channelId: string,
  overwriteId: string,
  reason?: string,
): Promise<DeleteChannelPermissionResult> {
  const loaded = await fetchEditableGuildChannel(channelId);
  if (!loaded.ok) {
    return loaded;
  }

  if (!loaded.channel.permissionOverwrites.cache.has(overwriteId)) {
    return { ok: false, error: 'overwrite_not_found' };
  }

  try {
    await loaded.channel.permissionOverwrites.delete(overwriteId, reason?.trim() || undefined);
    const refreshed = asEditableGuildChannel(await loaded.channel.fetch());
    if (!refreshed) {
      return { ok: false, error: 'channel_not_guild' };
    }
    return { ok: true, data: toGuildChannelDetail(refreshed) };
  } catch (error) {
    logger.error(
      `Failed to delete permission overwrite ${overwriteId} on ${channelId}: ${String(error)}`,
    );
    return { ok: false, error: 'delete_failed' };
  }
}
