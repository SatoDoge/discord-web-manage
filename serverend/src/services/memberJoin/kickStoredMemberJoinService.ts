import { kickGuildMember } from '#server/discord/kickMember.js';
import { getStoredMemberJoinForMeasure } from '#server/services/memberJoin/getStoredMemberJoinForMeasure.js';
import { appendMeasuredJoinEvent } from '#server/services/memberJoin/measuredMemberJoinRecord.js';
import {
  createMeasuredEntry,
  emptyMeasuredDetail,
} from '#server/services/message/measuredMessageRecord.js';
import { updateMemberJoinEvent } from '#server/stores/memberJoinDataStore.js';
import { removeMember } from '#server/stores/memberStore.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';

export type KickStoredMemberJoinError =
  | 'join_event_not_found'
  | 'not_filtered'
  | 'invalid_reason'
  | 'kick_failed';

export type KickStoredMemberJoinInput = {
  joinEventId: string;
  operationUserId: string;
  reason: unknown;
};

export type KickStoredMemberJoinResult =
  | { ok: true; data: StoredMemberJoinEvent }
  | { ok: false; error: KickStoredMemberJoinError; kickError?: string };

export async function kickStoredMemberJoin(
  input: KickStoredMemberJoinInput,
): Promise<KickStoredMemberJoinResult> {
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
  let kickError: string | undefined;

  try {
    await kickGuildMember(stored.guildId, stored.userId, reason);
    await removeMember(stored.userId).catch(() => undefined);
    succeeded = true;
  } catch (error) {
    kickError = error instanceof Error ? error.message : String(error);
  }

  appendMeasuredJoinEvent(
    stored,
    createMeasuredEntry(input.operationUserId, {
      command: succeeded ? 'kick' : 'none',
      ...emptyMeasuredDetail(),
      kickDetail: {
        reason,
        kickSeconds: 0,
      },
    }),
  );

  const updated = await updateMemberJoinEvent(stored);

  if (!succeeded) {
    return { ok: false, error: 'kick_failed', kickError };
  }

  return { ok: true, data: updated };
}
