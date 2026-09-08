import { ChannelType } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/getChannelList');

export type GuildChannelSummary = {
  id: string;
  name: string;
  type: ChannelType;
  parentId: string | null;
  parentName: string | null;
  /** Sibling / top-level position (Discord rawPosition). */
  position: number;
  /** Parent category rawPosition when nested; equals own position for top-level items. */
  parentPosition: number | null;
  /** Flattened Discord-like display order (0-based). */
  displayOrder: number;
  nsfw: boolean;
};

export type GetChannelListError = 'bot_not_connected' | 'guild_not_configured' | 'guild_not_found';

export type GetChannelListResult =
  | { ok: true; data: GuildChannelSummary[] }
  | { ok: false; error: GetChannelListError };

export type ChannelListScope = 'text' | 'manage';

type ChannelRow = Omit<GuildChannelSummary, 'displayOrder'>;

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

function isManageableChannel(type: ChannelType): boolean {
  return (
    type === ChannelType.GuildText ||
    type === ChannelType.GuildVoice ||
    type === ChannelType.GuildCategory ||
    type === ChannelType.GuildAnnouncement ||
    type === ChannelType.GuildStageVoice ||
    type === ChannelType.GuildForum ||
    type === ChannelType.GuildMedia
  );
}

function matchesScope(type: ChannelType, scope: ChannelListScope): boolean {
  return scope === 'manage' ? isManageableChannel(type) : isTextChannel(type);
}

function compareByPositionThenName(a: ChannelRow, b: ChannelRow): number {
  if (a.position !== b.position) {
    return a.position - b.position;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function isVoiceLikeType(type: ChannelType): boolean {
  return type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice;
}

/**
 * Discord client sidebar order:
 * 1. Uncategorized text-like channels (text / announcement / forum / media), by position
 * 2. Categories by position, each followed by its children by position
 * 3. Uncategorized voice-like channels (voice / stage), by position
 */
function sortManageChannels(channels: ChannelRow[]): GuildChannelSummary[] {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));
  const childrenByParent = new Map<string, ChannelRow[]>();
  const uncategorizedText: ChannelRow[] = [];
  const uncategorizedVoice: ChannelRow[] = [];
  const categories: ChannelRow[] = [];

  for (const channel of channels) {
    if (channel.type === ChannelType.GuildCategory) {
      categories.push(channel);
      continue;
    }

    if (channel.parentId && byId.has(channel.parentId)) {
      const siblings = childrenByParent.get(channel.parentId) ?? [];
      siblings.push(channel);
      childrenByParent.set(channel.parentId, siblings);
      continue;
    }

    if (isVoiceLikeType(channel.type)) {
      uncategorizedVoice.push(channel);
    } else {
      uncategorizedText.push(channel);
    }
  }

  uncategorizedText.sort(compareByPositionThenName);
  uncategorizedVoice.sort(compareByPositionThenName);
  categories.sort(compareByPositionThenName);
  for (const siblings of childrenByParent.values()) {
    siblings.sort(compareByPositionThenName);
  }

  const ordered: GuildChannelSummary[] = [];

  for (const channel of uncategorizedText) {
    ordered.push({ ...channel, displayOrder: ordered.length });
  }

  for (const category of categories) {
    ordered.push({ ...category, displayOrder: ordered.length });
    for (const child of childrenByParent.get(category.id) ?? []) {
      ordered.push({ ...child, displayOrder: ordered.length });
    }
  }

  for (const channel of uncategorizedVoice) {
    ordered.push({ ...channel, displayOrder: ordered.length });
  }

  return ordered;
}

/** Guild channels for search filters (`text`) or channel management (`manage`). */
export async function getGuildChannelList(
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
  scope: ChannelListScope = 'text',
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
    const categoryById = new Map<
      string,
      { name: string; position: number }
    >();
    for (const channel of channels.values()) {
      if (channel?.type === ChannelType.GuildCategory) {
        categoryById.set(channel.id, {
          name: channel.name,
          position: channel.rawPosition,
        });
      }
    }

    const rows: ChannelRow[] = channels
      .filter((channel) => channel != null && matchesScope(channel.type, scope))
      .map((channel) => {
        const position =
          'rawPosition' in channel! ? Number(channel!.rawPosition) : Number(channel!.position ?? 0);
        const parent = channel!.parentId ? categoryById.get(channel!.parentId) : undefined;
        return {
          id: channel!.id,
          name: channel!.name,
          type: channel!.type,
          parentId: channel!.parentId,
          parentName: parent?.name ?? null,
          position,
          parentPosition:
            channel!.type === ChannelType.GuildCategory
              ? position
              : (parent?.position ?? (channel!.parentId ? null : position)),
          nsfw: 'nsfw' in channel! ? Boolean(channel!.nsfw) : false,
        };
      });

    const data =
      scope === 'manage'
        ? sortManageChannels(rows)
        : [...rows]
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
            .map((row, index) => ({ ...row, displayOrder: index }));

    return { ok: true, data };
  } catch (error) {
    logger.error(`Failed to fetch guild channels: ${String(error)}`);
    return { ok: false, error: 'guild_not_found' };
  }
}
