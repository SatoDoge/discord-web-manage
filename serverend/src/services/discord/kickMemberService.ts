import { kickGuildMember } from '#server/discord/kickMember.js';
import { recordAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { getMember, removeMember } from '#server/stores/memberStore.js';
import type { MemberModerationResult } from '#server/services/discord/banMemberService.js';

export type KickMembersInput = {
  actorUserId: string;
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

  const success = failures.length === 0;
  recordAdminOperation({
    actorUserId: input.actorUserId,
    action: 'member.kick',
    category: 'member_join',
    targetType: 'user',
    targetId: input.userIds.length === 1 ? input.userIds[0] : null,
    success,
    errorMessage: success ? null : `${failures.length}件のキックに失敗`,
    summary: success
      ? `${succeeded}人のメンバーをキックしました`
      : `${succeeded}人をキック、${failures.length}人に失敗しました`,
    metadata: {
      userIds: input.userIds,
      reason,
      succeeded,
      failed: failures.length,
      failures,
    },
  });

  return {
    succeeded,
    failed: failures.length,
    failures,
  };
}
