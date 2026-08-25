import type {
  Activity,
  GuildMember,
  Presence,
  Role,
} from 'discord.js';
import type {
  StoredActivity,
  StoredGuildMember,
  StoredPresence,
  StoredRole,
} from '#server/types/member.js';

export function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function toStoredRole(role: Role): StoredRole {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    hexColor: role.hexColor,
    position: role.position,
    permissions: role.permissions.bitfield.toString(),
    managed: role.managed,
    hoist: role.hoist,
    mentionable: role.mentionable,
    iconURL: role.iconURL(),
    unicodeEmoji: role.unicodeEmoji,
  };
}

function toIsoFromTimestamp(
  value: number | Date | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toStoredActivity(activity: Activity): StoredActivity {
  return {
    name: activity.name,
    type: activity.type,
    state: activity.state,
    details: activity.details,
    url: activity.url,
    applicationId: activity.applicationId,
    startedAt: toIsoFromTimestamp(activity.timestamps?.start),
    endedAt: toIsoFromTimestamp(activity.timestamps?.end),
    emoji: activity.emoji
      ? {
          id: activity.emoji.id,
          name: activity.emoji.name,
          animated: activity.emoji.animated ?? false,
        }
      : null,
  };
}

export function toStoredPresence(
  presence: Presence,
  updatedAt: string,
): StoredPresence {
  const status =
    presence.status === 'invisible' ? 'offline' : presence.status;

  return {
    status,
    activities: presence.activities.map(toStoredActivity),
    clientStatus: presence.clientStatus
      ? {
          desktop: presence.clientStatus.desktop ?? null,
          mobile: presence.clientStatus.mobile ?? null,
          web: presence.clientStatus.web ?? null,
        }
      : null,
    updatedAt,
  };
}

export type StoredMemberTimestamps = {
  firstSeenAt: string;
  profileUpdatedAt: string;
  memberUpdatedAt: string;
  lastSyncedAt: string;
};

/** Map a discord.js GuildMember into our stored shape. */
export function toStoredGuildMember(
  member: GuildMember,
  presence: StoredPresence | null,
  timestamps: StoredMemberTimestamps,
): StoredGuildMember {
  const { user } = member;

  return {
    id: member.id,

    username: user.username,
    globalName: user.globalName,
    avatarHash: user.avatar,
    avatarURL: user.displayAvatarURL(),
    bannerHash: user.banner,
    bannerURL: user.bannerURL(),
    bot: user.bot,
    system: user.system,
    accountCreatedAt: user.createdAt.toISOString(),

    displayName: member.displayName,
    nickname: member.nickname,
    guildAvatarHash: member.avatar,
    guildAvatarURL: member.avatarURL(),
    guildBannerHash: member.banner,
    guildBannerURL: member.bannerURL(),

    roles: member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .map(toStoredRole)
      .sort((a, b) => b.position - a.position),

    joinedAt: toIso(member.joinedAt),
    premiumSince: toIso(member.premiumSince),
    pending: member.pending,
    communicationDisabledUntil: toIso(member.communicationDisabledUntil),
    flags: Number(member.flags.bitfield),

    presence,

    firstSeenAt: timestamps.firstSeenAt,
    profileUpdatedAt: timestamps.profileUpdatedAt,
    memberUpdatedAt: timestamps.memberUpdatedAt,
    lastSyncedAt: timestamps.lastSyncedAt,
  };
}

export function isTargetGuild(guildId: string): boolean {
  const configured = process.env.DISCORD_GUILD_ID?.trim();
  return !configured || guildId === configured;
}
