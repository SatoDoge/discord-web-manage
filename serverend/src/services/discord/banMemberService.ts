import { banGuildMember } from '#server/discord/banMember.js';
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
