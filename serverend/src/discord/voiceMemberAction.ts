import {
  ChannelType,
  PermissionsBitField,
  type GuildMember,
  type VoiceBasedChannel,
} from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/voiceMemberAction');

export type VoiceMemberAction =
  | 'disconnect'
  | 'move'
  | 'mute'
  | 'unmute'
  | 'deaf'
  | 'undeaf';

export type VoiceMemberActionError =
  | 'bot_not_connected'
  | 'guild_not_configured'
  | 'guild_not_found'
  | 'missing_permission'
  | 'member_not_found'
  | 'not_in_voice'
  | 'invalid_target_channel'
  | 'action_failed';

export type VoiceMemberActionInput = {
  userId: string;
  action: VoiceMemberAction;
  /** Required when action is `move`. */
  channelId?: string;
  reason?: string;
};

export type VoiceMemberActionResult =
  | { ok: true }
  | { ok: false; error: VoiceMemberActionError };

function isVoiceLike(channel: { type: ChannelType } | null): channel is VoiceBasedChannel {
  return (
    channel !== null &&
    (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice)
  );
}

function requiredPermission(action: VoiceMemberAction): bigint {
  switch (action) {
    case 'mute':
    case 'unmute':
      return PermissionsBitField.Flags.MuteMembers;
    case 'deaf':
    case 'undeaf':
      return PermissionsBitField.Flags.DeafenMembers;
    case 'disconnect':
    case 'move':
    default:
      return PermissionsBitField.Flags.MoveMembers;
  }
}

/**
 * Apply a voice moderation action to a single guild member currently in voice.
 */
export async function applyVoiceMemberAction(
  input: VoiceMemberActionInput,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<VoiceMemberActionResult> {
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
    const permission = requiredPermission(input.action);
    if (!me.permissions.has(permission)) {
      return { ok: false, error: 'missing_permission' };
    }

    let member: GuildMember;
    try {
      member = await guild.members.fetch(input.userId);
    } catch {
      return { ok: false, error: 'member_not_found' };
    }

    if (!member.voice.channelId && input.action !== 'move') {
      return { ok: false, error: 'not_in_voice' };
    }
    // Move also requires the member to be connected (Discord API restriction).
    if (input.action === 'move' && !member.voice.channelId) {
      return { ok: false, error: 'not_in_voice' };
    }

    const reason = input.reason?.trim() || undefined;

    switch (input.action) {
      case 'disconnect':
        await member.voice.disconnect(reason);
        break;
      case 'move': {
        if (!input.channelId) {
          return { ok: false, error: 'invalid_target_channel' };
        }
        const target = await guild.channels.fetch(input.channelId).catch(() => null);
        if (!isVoiceLike(target)) {
          return { ok: false, error: 'invalid_target_channel' };
        }
        await member.voice.setChannel(target, reason);
        break;
      }
      case 'mute':
        await member.voice.setMute(true, reason);
        break;
      case 'unmute':
        await member.voice.setMute(false, reason);
        break;
      case 'deaf':
        await member.voice.setDeaf(true, reason);
        break;
      case 'undeaf':
        await member.voice.setDeaf(false, reason);
        break;
      default:
        return { ok: false, error: 'action_failed' };
    }

    return { ok: true };
  } catch (error) {
    logger.error(
      `Failed voice action ${input.action} for ${input.userId}: ${String(error)}`,
    );
    return { ok: false, error: 'action_failed' };
  }
}
