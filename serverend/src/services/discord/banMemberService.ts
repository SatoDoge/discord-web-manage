import { banGuildMember } from '#server/discord/banMember.js';
import { recordAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { getMember, removeMember } from '#server/stores/memberStore.js';

export type MemberModerationFailure = {
  userId: string;
  username: string | null;
  displayName: string | null;
  error: string;
};

export type MemberModerationResult = {
  succeeded: number;
  failed: number;
  failures: MemberModerationFailure[];
};

export type BanMembersInput = {
  actorUserId: string;
  userIds: string[];
  reason: string;
  deleteMessageSeconds?: number;
};

const MAX_DELETE_MESSAGE_SECONDS = 7 * 24 * 60 * 60;

export async function banMembers(input: BanMembersInput): Promise<MemberModerationResult> {
  const reason = input.reason.trim();
  const deleteMessageSeconds = input.deleteMessageSeconds ?? 0;
  const failures: MemberModerationFailure[] = [];
  let succeeded = 0;

  for (const userId of input.userIds) {
    const member = await getMember(userId);
    const username = member?.username ?? null;
    const displayName = member?.displayName ?? null;

    try {
      await banGuildMember(
        process.env.DISCORD_GUILD_ID?.trim() ?? '',
        userId,
        reason,
        deleteMessageSeconds,
      );
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
    action: 'member.ban',
    category: 'member_join',
    targetType: 'user',
    targetId: input.userIds.length === 1 ? input.userIds[0] : null,
    success,
    errorMessage: success ? null : `${failures.length}件のBANに失敗`,
    summary: success
      ? `${succeeded}人のメンバーをBANしました`
      : `${succeeded}人をBAN、${failures.length}人に失敗しました`,
    metadata: {
      userIds: input.userIds,
      reason,
      deleteMessageSeconds,
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

export function isValidDeleteMessageSeconds(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_DELETE_MESSAGE_SECONDS
  );
}
