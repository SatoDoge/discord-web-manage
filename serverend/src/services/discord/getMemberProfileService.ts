import {
  getGlobalUserProfile,
  getGuildMemberProfile,
  type GlobalUserProfile,
  type GuildMemberProfile,
  type MemberProfileResult,
} from '#server/discord/getMemberProfile.js';

/** Discord-wide profile for a user ID. */
export function fetchGlobalUserProfile(
  userId: string,
): Promise<MemberProfileResult<GlobalUserProfile>> {
  return getGlobalUserProfile(userId);
}

/** Profile of a user inside the current (or specified) guild. */
export function fetchGuildMemberProfile(
  userId: string,
  guildId?: string,
): Promise<MemberProfileResult<GuildMemberProfile>> {
  return getGuildMemberProfile(userId, guildId);
}
