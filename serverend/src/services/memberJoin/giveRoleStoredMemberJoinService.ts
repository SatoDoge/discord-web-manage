import { giveRoleToMember } from '#server/discord/giveRoleMember.js';
import { getStoredMemberJoinForMeasure } from '#server/services/memberJoin/getStoredMemberJoinForMeasure.js';
import { appendMeasuredJoinEvent } from '#server/services/memberJoin/measuredMemberJoinRecord.js';
import {
  createMeasuredEntry,
  emptyMeasuredDetail,
} from '#server/services/message/measuredMessageRecord.js';
import { isSnowflake } from '#server/services/message/validation.js';
import { updateMemberJoinEvent } from '#server/stores/memberJoinDataStore.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';

export type GiveRoleStoredMemberJoinError =
  | 'join_event_not_found'
  | 'not_filtered'
  | 'invalid_role_id'
  | 'role_failed';

export type GiveRoleStoredMemberJoinInput = {
  joinEventId: string;
  operationUserId: string;
  roleId: unknown;
};

export type GiveRoleStoredMemberJoinResult =
  | { ok: true; data: StoredMemberJoinEvent }
  | { ok: false; error: GiveRoleStoredMemberJoinError; roleError?: string };

export async function giveRoleStoredMemberJoin(
  input: GiveRoleStoredMemberJoinInput,
): Promise<GiveRoleStoredMemberJoinResult> {
  if (!isSnowflake(input.roleId)) {
    return { ok: false, error: 'invalid_role_id' };
  }

  const lookup = await getStoredMemberJoinForMeasure(input.joinEventId);
  if (!lookup.ok) {
    return { ok: false, error: lookup.error };
  }

  const stored = lookup.event;
  let succeeded = false;
  let roleError: string | undefined;

  try {
    await giveRoleToMember(stored.guildId, stored.userId, input.roleId);
    succeeded = true;
  } catch (error) {
    roleError = error instanceof Error ? error.message : String(error);
  }

  appendMeasuredJoinEvent(
    stored,
    createMeasuredEntry(input.operationUserId, {
      command: succeeded ? 'role' : 'none',
      ...emptyMeasuredDetail(),
      roleDetail: { roleId: input.roleId },
    }),
  );

  const updated = await updateMemberJoinEvent(stored);

  if (!succeeded) {
    return { ok: false, error: 'role_failed', roleError };
  }

  return { ok: true, data: updated };
}
