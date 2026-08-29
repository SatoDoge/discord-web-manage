import { banGuildMember } from '#server/discord/banMember.js';
import { isValidDeleteMessageSeconds } from '#server/services/discord/banMemberService.js';
import { getStoredMessageForMeasure } from '#server/services/message/getStoredMessageForMeasure.js';
import {
  appendMeasuredMessage,
  createMeasuredEntry,
  emptyMeasuredDetail,
} from '#server/services/message/measuredMessageRecord.js';
import { updateMessage } from '#server/stores/messageDataStore.js';
import { removeMember } from '#server/stores/memberStore.js';
import type { StoredGuildMessage } from '#server/types/messageData.js';

export type BanStoredMessageError =
  | 'message_not_found'
  | 'not_filtered'
  | 'invalid_reason'
  | 'invalid_delete_message_seconds'
  | 'ban_failed';

export type BanStoredMessageInput = {
  messageId: string;
  operationUserId: string;
  reason: unknown;
  deleteMessageSeconds?: unknown;
};

export type BanStoredMessageResult =
  | { ok: true; data: StoredGuildMessage }
  | { ok: false; error: BanStoredMessageError; banError?: string };

export async function banStoredMessage(
  input: BanStoredMessageInput,
): Promise<BanStoredMessageResult> {
  if (typeof input.reason !== 'string' || !input.reason.trim()) {
    return { ok: false, error: 'invalid_reason' };
  }

  const deleteMessageSeconds =
    input.deleteMessageSeconds === undefined ? 0 : input.deleteMessageSeconds;
  if (!isValidDeleteMessageSeconds(deleteMessageSeconds)) {
    return { ok: false, error: 'invalid_delete_message_seconds' };
  }

  const lookup = await getStoredMessageForMeasure(input.messageId);
  if (!lookup.ok) {
    return { ok: false, error: lookup.error };
  }

  const stored = lookup.message;
  const reason = input.reason.trim();
  let succeeded = false;
  let banError: string | undefined;

  try {
    await banGuildMember(
      stored.guildId,
      stored.author.userId,
      reason,
      deleteMessageSeconds,
    );
    await removeMember(stored.author.userId).catch(() => undefined);
    succeeded = true;
  } catch (error) {
    banError = error instanceof Error ? error.message : String(error);
  }

  appendMeasuredMessage(
    stored,
    createMeasuredEntry(input.operationUserId, {
      command: succeeded ? 'ban' : 'none',
      ...emptyMeasuredDetail(),
      banDetail: {
        reason,
        deleteMessageSeconds,
      },
    }),
  );

  const updated = await updateMessage(stored);

  if (!succeeded) {
    return { ok: false, error: 'ban_failed', banError };
  }

  return { ok: true, data: updated };
}
