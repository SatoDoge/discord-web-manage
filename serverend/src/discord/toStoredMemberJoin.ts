import type { GuildMember } from 'discord.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';

/** Map a discord.js GuildMember into a stored join-event shape. */
export function toStoredMemberJoinEvent(
  member: GuildMember,
  syncedAt: string,
): StoredMemberJoinEvent {
  const joinedAt = member.joinedAt?.toISOString() ?? syncedAt;
  const { user } = member;

  return {
    joinEventId: `${member.id}-${joinedAt}`,
    userId: member.id,
    guildId: member.guild.id,

    username: user.username,
    globalName: user.globalName,
    displayName: member.displayName,
    nickname: member.nickname,
    avatarURL: user.displayAvatarURL(),
    bot: user.bot,

    accountCreatedAt: user.createdAt.toISOString(),
    joinedAt,

    firstSeenAt: syncedAt,
    lastSyncedAt: syncedAt,

    nameFilter: null,
    joinDelayFilter: null,
    memberProfileModerationFilter: null,
    memberProfileModerationDetail: null,

    isFiltered: false,
    isMeasured: false,
    measuredMessage: null,
  };
}
