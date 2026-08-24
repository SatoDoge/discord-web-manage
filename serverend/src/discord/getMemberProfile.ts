import { DiscordAPIError } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/getMemberProfile');

export type GlobalUserProfile = {
  id: string;
  username: string;
  globalName: string | null;
  discriminator: string;
  bot: boolean;
  avatarURL: string | null;
  bannerURL: string | null;
  accentColor: number | null;
  createdAt: number;
};

export type GuildMemberProfile = {
  userId: string;
  guildId: string;
  username: string;
  globalName: string | null;
  displayName: string;
  nickname: string | null;
  avatarURL: string | null;
  guildAvatarURL: string | null;
  bot: boolean;
  joinedAt: number | null;
  pending: boolean;
  roles: {
    id: string;
    name: string;
    color: number;
    position: number;
  }[];
};

export type MemberProfileError =
  | 'bot_not_connected'
  | 'guild_not_configured'
  | 'guild_not_found'
  | 'user_not_found'
  | 'member_not_found';

export type MemberProfileResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: MemberProfileError };

function isUnknownResource(error: unknown): boolean {
  return error instanceof DiscordAPIError && (error.code === 10013 || error.code === 10007);
}

/** Discord-wide user profile via client.users.fetch. */
export async function getGlobalUserProfile(
  userId: string,
): Promise<MemberProfileResult<GlobalUserProfile>> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  try {
    const user = await client.users.fetch(userId, { force: true });
    return {
      ok: true,
      data: {
        id: user.id,
        username: user.username,
        globalName: user.globalName,
        discriminator: user.discriminator,
        bot: user.bot,
        avatarURL: user.displayAvatarURL(),
        bannerURL: user.bannerURL() ?? null,
        accentColor: user.accentColor ?? null,
        createdAt: user.createdTimestamp,
      },
    };
  } catch (error) {
    if (isUnknownResource(error)) {
      return { ok: false, error: 'user_not_found' };
    }
    logger.error(`Failed to fetch global user ${userId}: ${String(error)}`);
    throw error;
  }
}

/** Guild member profile via guild.members.fetch. */
export async function getGuildMemberProfile(
  userId: string,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<MemberProfileResult<GuildMemberProfile>> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  if (!guildId) {
    return { ok: false, error: 'guild_not_configured' };
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    return { ok: false, error: 'guild_not_found' };
  }

  try {
    const member = await guild.members.fetch({ user: userId, force: true });
    return {
      ok: true,
      data: {
        userId: member.id,
        guildId: guild.id,
        username: member.user.username,
        globalName: member.user.globalName,
        displayName: member.displayName,
        nickname: member.nickname,
        avatarURL: member.user.displayAvatarURL(),
        guildAvatarURL: member.displayAvatarURL(),
        bot: member.user.bot,
        joinedAt: member.joinedTimestamp,
        pending: member.pending,
        roles: member.roles.cache
          .filter((role) => role.id !== guild.id)
          .map((role) => ({
            id: role.id,
            name: role.name,
            color: role.color,
            position: role.position,
          }))
          .sort((a, b) => b.position - a.position),
      },
    };
  } catch (error) {
    if (isUnknownResource(error)) {
      return { ok: false, error: 'member_not_found' };
    }
    logger.error(`Failed to fetch guild member ${userId}: ${String(error)}`);
    throw error;
  }
}
