import { kickGuildMember } from '#server/discord/kickMember.js';
import { recordAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { getStoredMessageForMeasure } from '#server/services/message/getStoredMessageForMeasure.js';
import {
  appendMeasuredMessage,
  createMeasuredEntry,
  emptyMeasuredDetail,
} from '#server/services/message/measuredMessageRecord.js';
import { updateMessage } from '#server/stores/messageDataStore.js';
import { removeMember } from '#server/stores/memberStore.js';
import type { StoredGuildMessage } from '#server/types/messageData.js';

export type KickStoredMessageError =
  | 'message_not_found'
  | 'not_filtered'
  | 'invalid_reason'
  | 'invalid_kick_seconds'
  | 'kick_failed';

export type KickStoredMessageInput = {
  messageId: string;
  operationUserId: string;
  reason: unknown;
  kickSeconds?: unknown;
};

export type KickStoredMessageResult =
  | { ok: true; data: StoredGuildMessage }
  | { ok: false; error: KickStoredMessageError; kickError?: string };

function isValidKickSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export async function kickStoredMessage(
  input: KickStoredMessageInput,
): Promise<KickStoredMessageResult> {
  if (typeof input.reason !== 'string' || !input.reason.trim()) {
    recordAdminOperation({
      actorUserId: input.operationUserId,
      action: 'message.filtered.kick',
      category: 'message',
      targetType: 'message',
      targetId: input.messageId,
      success: false,
      errorMessage: 'invalid_reason',
      summary: 'フィルター済みメッセージの作者キックに失敗しました（無効な理由）',
    });
    return { ok: false, error: 'invalid_reason' };
  }

  const kickSeconds = input.kickSeconds === undefined ? 0 : input.kickSeconds;
  if (!isValidKickSeconds(kickSeconds)) {
    recordAdminOperation({
      actorUserId: input.operationUserId,
      action: 'message.filtered.kick',
      category: 'message',
      targetType: 'message',
      targetId: input.messageId,
      success: false,
      errorMessage: 'invalid_kick_seconds',
      summary: 'フィルター済みメッセージの作者キックに失敗しました（無効なキック秒数）',
    });
    return { ok: false, error: 'invalid_kick_seconds' };
  }

  const lookup = await getStoredMessageForMeasure(input.messageId);
  if (!lookup.ok) {
    recordAdminOperation({
      actorUserId: input.operationUserId,
      action: 'message.filtered.kick',
      category: 'message',
      targetType: 'message',
      targetId: input.messageId,
      success: false,
      errorMessage: lookup.error,
      summary: 'フィルター済みメッセージの作者キックに失敗しました',
    });
    return { ok: false, error: lookup.error };
  }

  const stored = lookup.message;
  const reason = input.reason.trim();
  let succeeded = false;
  let kickError: string | undefined;

  try {
    await kickGuildMember(stored.guildId, stored.author.userId, reason);
    await removeMember(stored.author.userId).catch(() => undefined);
    succeeded = true;
  } catch (error) {
    kickError = error instanceof Error ? error.message : String(error);
  }

  appendMeasuredMessage(
    stored,
    createMeasuredEntry(input.operationUserId, {
      command: succeeded ? 'kick' : 'none',
      ...emptyMeasuredDetail(),
      kickDetail: {
        reason,
        kickSeconds,
      },
    }),
  );

  const updated = await updateMessage(stored);

  if (!succeeded) {
    recordAdminOperation({
      actorUserId: input.operationUserId,
      action: 'message.filtered.kick',
      category: 'message',
      targetType: 'user',
      targetId: stored.author.userId,
      success: false,
      errorMessage: kickError,
      summary: 'フィルター済みメッセージの作者キックに失敗しました',
      metadata: { messageId: input.messageId, reason, kickSeconds },
    });
    return { ok: false, error: 'kick_failed', kickError };
  }

  recordAdminOperation({
    actorUserId: input.operationUserId,
    action: 'message.filtered.kick',
    category: 'message',
    targetType: 'user',
    targetId: stored.author.userId,
    success: true,
    summary: 'フィルター済みメッセージの作者をキックしました',
    metadata: { messageId: input.messageId, reason, kickSeconds },
  });

  return { ok: true, data: updated };
}
