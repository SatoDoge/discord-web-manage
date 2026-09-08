import {
  applyVoiceMemberAction,
  type VoiceMemberAction,
  type VoiceMemberActionError,
} from '#server/discord/voiceMemberAction.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type VoiceActionFailure = {
  userId: string;
  error: VoiceMemberActionError | 'invalid_user_id';
};

export type VoiceMembersActionResult =
  | {
      ok: true;
      succeeded: number;
      failed: number;
      failures: VoiceActionFailure[];
    }
  | {
      ok: false;
      status: number;
      error:
        | 'invalid_user_ids'
        | 'invalid_action'
        | 'invalid_channel_id'
        | 'invalid_reason'
        | 'empty_user_ids';
    };

const ACTIONS: readonly VoiceMemberAction[] = [
  'disconnect',
  'move',
  'mute',
  'unmute',
  'deaf',
  'undeaf',
] as const;

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function isVoiceMemberAction(value: unknown): value is VoiceMemberAction {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);
}

function actionSummary(action: VoiceMemberAction, succeeded: number, failed: number): string {
  const labels: Record<VoiceMemberAction, string> = {
    disconnect: '切断',
    move: '移動',
    mute: 'サーバーミュート',
    unmute: 'サーバーミュート解除',
    deaf: 'スピーカーミュート',
    undeaf: 'スピーカーミュート解除',
  };
  const label = labels[action];
  if (failed === 0) {
    return `${succeeded}人を${label}しました`;
  }
  return `${succeeded}人を${label}、${failed}人に失敗しました`;
}

export type VoiceMembersActionBody = {
  userIds?: unknown;
  action?: unknown;
  channelId?: unknown;
  reason?: unknown;
};

/** Validate input and apply a voice action to one or more members. */
export async function applyVoiceMembersAction(
  body: VoiceMembersActionBody,
  context: AuthenticatedServiceContext,
): Promise<VoiceMembersActionResult> {
  if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
    return { ok: false, status: 400, error: 'empty_user_ids' };
  }
  if (!body.userIds.every((id) => typeof id === 'string' && isSnowflake(id))) {
    return { ok: false, status: 400, error: 'invalid_user_ids' };
  }
  if (!isVoiceMemberAction(body.action)) {
    return { ok: false, status: 400, error: 'invalid_action' };
  }

  const action = body.action;
  let channelId: string | undefined;
  if (action === 'move') {
    if (typeof body.channelId !== 'string' || !isSnowflake(body.channelId)) {
      return { ok: false, status: 400, error: 'invalid_channel_id' };
    }
    channelId = body.channelId;
  }

  if (body.reason !== undefined && typeof body.reason !== 'string') {
    return { ok: false, status: 400, error: 'invalid_reason' };
  }
  const reason = typeof body.reason === 'string' ? body.reason : undefined;
  const userIds = body.userIds as string[];

  const failures: VoiceActionFailure[] = [];
  let succeeded = 0;

  for (const userId of userIds) {
    const result = await applyVoiceMemberAction({
      userId,
      action,
      channelId,
      reason,
    });
    if (!result.ok) {
      failures.push({ userId, error: result.error });
    } else {
      succeeded += 1;
    }
  }

  const success = failures.length === 0;
  recordAuthenticatedAdminOperation(context, {
    action: `voice.${action}`,
    category: 'voice',
    targetType: 'user',
    targetId: userIds.length === 1 ? userIds[0] : null,
    success,
    errorMessage: success ? null : `${failures.length}件失敗`,
    summary: actionSummary(action, succeeded, failures.length),
    metadata: {
      userIds,
      channelId: channelId ?? null,
      reason: reason ?? null,
      succeeded,
      failed: failures.length,
      failures,
    },
  });

  return {
    ok: true,
    succeeded,
    failed: failures.length,
    failures,
  };
}
