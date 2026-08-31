import { banGuildMember } from '#server/discord/banMember.js';
import { getStoredMemberJoinForMeasure } from '#server/services/memberJoin/getStoredMemberJoinForMeasure.js';
import { appendMeasuredJoinEvent } from '#server/services/memberJoin/measuredMemberJoinRecord.js';
import {
  createMeasuredEntry,
  emptyMeasuredDetail,
} from '#server/services/message/measuredMessageRecord.js';
import { updateMemberJoinEvent } from '#server/stores/memberJoinDataStore.js';
import { removeMember } from '#server/stores/memberStore.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';

export type BanStoredMemberJoinError =
  | 'join_event_not_found'
  | 'not_filtered'
  | 'invalid_reason'
  | 'ban_failed';

export type BanStoredMemberJoinInput = {
  joinEventId: string;
  operationUserId: string;
  reason: unknown;
};

export type BanStoredMemberJoinResult =
  | { ok: true; data: StoredMemberJoinEvent }
  | { ok: false; error: BanStoredMemberJoinError; banError?: string };

export async function banStoredMemberJoin(
  input: BanStoredMemberJoinInput,
): Promise<BanStoredMemberJoinResult> {
  if (typeof input.reason !== 'string' || !input.reason.trim()) {
    return { ok: false, error: 'invalid_reason' };
  }

  const lookup = await getStoredMemberJoinForMeasure(input.joinEventId);
  if (!lookup.ok) {
    return { ok: false, error: lookup.error };
  }

  const stored = lookup.event;
  const reason = input.reason.trim();
  let succeeded = false;
  let banError: string | undefined;

  try {
    await banGuildMember(stored.guildId, stored.userId, reason, 0);
    await removeMember(stored.userId).catch(() => undefined);
    succeeded = true;
  } catch (error) {
    banError = error instanceof Error ? error.message : String(error);
  }

  appendMeasuredJoinEvent(
    stored,
    createMeasuredEntry(input.operationUserId, {
      command: succeeded ? 'ban' : 'none',
      ...emptyMeasuredDetail(),
      banDetail: {
        reason,
        deleteMessageSeconds: 0,
      },
    }),
  );

  const updated = await updateMemberJoinEvent(stored);

  if (!succeeded) {
    return { ok: false, error: 'ban_failed', banError };
  }

  return { ok: true, data: updated };
}
