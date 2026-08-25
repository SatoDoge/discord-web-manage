import { getMember } from '#server/stores/memberStore.js';
import type { StoredGuildMember } from '#server/types/member.js';
import type {
  GlobalUserProfile,
  GuildMemberProfile,
  MemberProfileError,
  MemberProfileResult,
} from '#server/discord/getMemberProfile.js';

export type {
  GlobalUserProfile,
  GuildMemberProfile,
  MemberProfileError,
  MemberProfileResult,
};

function toGlobalUserProfile(member: StoredGuildMember): GlobalUserProfile {
  return {
    id: member.id,
    username: member.username,
    globalName: member.globalName,
    discriminator: '0',
    bot: member.bot,
    avatarURL: member.avatarURL,
    bannerURL: member.bannerURL ?? null,
    accentColor: null,
    createdAt: Date.parse(member.accountCreatedAt),
  };
}

function toGuildMemberProfile(member: StoredGuildMember): GuildMemberProfile {
  return {
    userId: member.id,
    guildId: process.env.DISCORD_GUILD_ID?.trim() ?? '',
    username: member.username,
    globalName: member.globalName,
    displayName: member.displayName,
    nickname: member.nickname,
    avatarURL: member.avatarURL,
    guildAvatarURL: member.guildAvatarURL ?? member.avatarURL,
    bot: member.bot,
    joinedAt: member.joinedAt ? Date.parse(member.joinedAt) : null,
    pending: member.pending ?? false,
    roles: member.roles
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
      }))
      .sort((a, b) => b.position - a.position),
  };
}

/** Discord-wide profile fields from the local member store. */
export async function fetchGlobalUserProfile(
  userId: string,
): Promise<MemberProfileResult<GlobalUserProfile>> {
  const member = await getMember(userId);
  if (!member) {
    return { ok: false, error: 'user_not_found' };
  }
  return { ok: true, data: toGlobalUserProfile(member) };
}

/** Guild member profile from the local member store. */
export async function fetchGuildMemberProfile(
  userId: string,
  _guildId?: string,
): Promise<MemberProfileResult<GuildMemberProfile>> {
  const member = await getMember(userId);
  if (!member) {
    return { ok: false, error: 'member_not_found' };
  }
  return { ok: true, data: toGuildMemberProfile(member) };
}
