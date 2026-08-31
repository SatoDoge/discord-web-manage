import { giveRoleToMember } from '#server/discord/giveRoleMember.js';
import { getStoredMessageForMeasure } from '#server/services/message/getStoredMessageForMeasure.js';
import {
  appendMeasuredMessage,
  createMeasuredEntry,
  emptyMeasuredDetail,
} from '#server/services/message/measuredMessageRecord.js';
import { isSnowflake } from '#server/services/message/validation.js';
import { updateMessage } from '#server/stores/messageDataStore.js';
import type { StoredGuildMessage } from '#server/types/messageData.js';

export type GiveRoleStoredMessageError =
  | 'message_not_found'
  | 'not_filtered'
  | 'invalid_role_id'
  | 'role_failed';

export type GiveRoleStoredMessageInput = {
  messageId: string;
  operationUserId: string;
  roleId: unknown;
};

export type GiveRoleStoredMessageResult =
  | { ok: true; data: StoredGuildMessage }
  | { ok: false; error: GiveRoleStoredMessageError; roleError?: string };

export async function giveRoleStoredMessage(
  input: GiveRoleStoredMessageInput,
): Promise<GiveRoleStoredMessageResult> {
  if (!isSnowflake(input.roleId)) {
    return { ok: false, error: 'invalid_role_id' };
  }

  const lookup = await getStoredMessageForMeasure(input.messageId);
  if (!lookup.ok) {
    return { ok: false, error: lookup.error };
  }

  const stored = lookup.message;
  let succeeded = false;
  let roleError: string | undefined;

  try {
    await giveRoleToMember(stored.guildId, stored.author.userId, input.roleId);
    succeeded = true;
  } catch (error) {
    roleError = error instanceof Error ? error.message : String(error);
  }

  appendMeasuredMessage(
    stored,
    createMeasuredEntry(input.operationUserId, {
      command: succeeded ? 'role' : 'none',
      ...emptyMeasuredDetail(),
      roleDetail: { roleId: input.roleId },
    }),
  );

  const updated = await updateMessage(stored);

  if (!succeeded) {
    return { ok: false, error: 'role_failed', roleError };
  }

  return { ok: true, data: updated };
}
