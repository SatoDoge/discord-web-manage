import { ChannelType, type GuildMember, type VoiceBasedChannel } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/getVoiceOccupancy');

export type VoiceMemberOccupancy = {
  id: string;
  username: string;
  displayName: string;
  avatarURL: string;
  channelId: string;
  selfMute: boolean;
  selfDeaf: boolean;
  serverMute: boolean;
  serverDeaf: boolean;
  streaming: boolean;
  selfVideo: boolean;
  suppress: boolean;
};

export type VoiceChannelOccupancy = {
  id: string;
  name: string;
  type: ChannelType.GuildVoice | ChannelType.GuildStageVoice;
  parentId: string | null;
  parentName: string | null;
  position: number;
  userLimit: number;
  memberCount: number;
  members: VoiceMemberOccupancy[];
};

export type GetVoiceOccupancyError =
  | 'bot_not_connected'
  | 'guild_not_configured'
  | 'guild_not_found';

export type GetVoiceOccupancyResult =
  | { ok: true; data: VoiceChannelOccupancy[] }
  | { ok: false; error: GetVoiceOccupancyError };

function isVoiceLikeChannel(
  channel: { type: ChannelType },
): channel is VoiceBasedChannel {
  return (
    channel.type === ChannelType.GuildVoice ||
    channel.type === ChannelType.GuildStageVoice
  );
}

function toMemberOccupancy(member: GuildMember, channelId: string): VoiceMemberOccupancy {
  const voice = member.voice;
  return {
    id: member.id,
    username: member.user.username,
    displayName: member.displayName,
    avatarURL: member.displayAvatarURL({ size: 64 }),
    channelId,
    selfMute: Boolean(voice.selfMute),
    selfDeaf: Boolean(voice.selfDeaf),
    serverMute: Boolean(voice.serverMute),
    serverDeaf: Boolean(voice.serverDeaf),
    streaming: Boolean(voice.streaming),
    selfVideo: Boolean(voice.selfVideo),
    suppress: Boolean(voice.suppress),
  };
}

/**
 * List guild voice/stage channels with currently connected members.
 * Empty channels are included so operators can move members into them.
 */
export async function getVoiceChannelOccupancy(
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<GetVoiceOccupancyResult> {
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
    await Promise.all([guild.channels.fetch(), guild.members.fetch().catch(() => null)]);

    const voiceChannels = [...guild.channels.cache.values()]
      .filter(isVoiceLikeChannel)
      .sort((a, b) => a.rawPosition - b.rawPosition || a.position - b.position);

    const membersByChannel = new Map<string, VoiceMemberOccupancy[]>();
    for (const state of guild.voiceStates.cache.values()) {
      if (!state.channelId) {
        continue;
      }
      const member =
        state.member ??
        (await guild.members.fetch(state.id).catch(() => null));
      if (!member) {
        continue;
      }
      const list = membersByChannel.get(state.channelId) ?? [];
      list.push(toMemberOccupancy(member, state.channelId));
      membersByChannel.set(state.channelId, list);
    }

    const data: VoiceChannelOccupancy[] = voiceChannels.map((channel) => {
      const members = (membersByChannel.get(channel.id) ?? []).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'ja'),
      );
      const parent =
        channel.parent && channel.parent.type === ChannelType.GuildCategory
          ? channel.parent
          : null;

      return {
        id: channel.id,
        name: channel.name,
        type: channel.type as ChannelType.GuildVoice | ChannelType.GuildStageVoice,
        parentId: parent?.id ?? null,
        parentName: parent?.name ?? null,
        position: channel.position,
        userLimit: channel.userLimit,
        memberCount: members.length,
        members,
      };
    });

    return { ok: true, data };
  } catch (error) {
    logger.error(`Failed to fetch voice occupancy: ${String(error)}`);
    return { ok: false, error: 'guild_not_found' };
  }
}
