import { kickGuildMember } from '#server/discord/kickMember.js';
import { getMember, removeMember } from '#server/stores/memberStore.js';
import type { MemberModerationResult } from '#server/services/discord/banMemberService.js';

export type KickMembersInput = {
  userIds: string[];
  reason: string;
};

export async function kickMembers(input: KickMembersInput): Promise<MemberModerationResult> {
  const reason = input.reason.trim();
  const failures: MemberModerationResult['failures'] = [];
  let succeeded = 0;

  for (const userId of input.userIds) {
    const member = await getMember(userId);
    const username = member?.username ?? null;
    const displayName = member?.displayName ?? null;

    try {
      await kickGuildMember(process.env.DISCORD_GUILD_ID?.trim() ?? '', userId, reason);
      await removeMember(userId).catch(() => undefined);
      succeeded += 1;
    } catch (error) {
      failures.push({
        userId,
        username,
        displayName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    succeeded,
    failed: failures.length,
    failures,
  };
}
