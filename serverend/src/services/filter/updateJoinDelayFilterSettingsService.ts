import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { isJoinDelayFilterSettings } from '#server/services/filter/validateMemberFilterSettings.js';
import { updateJoinDelayFilterSettings } from '#server/stores/memberFilterSettingsStore.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { JoinDelayFilterSettings } from '#server/types/memberFilterSettings.js';

export type UpdateJoinDelayFilterSettingsResult =
  | { ok: true; data: JoinDelayFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveJoinDelayFilterSettings(
  settings: unknown,
  context: AuthenticatedServiceContext,
): Promise<UpdateJoinDelayFilterSettingsResult> {
  if (!isJoinDelayFilterSettings(settings)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'filter.member.join_delay.update',
      category: 'settings',
      success: false,
      errorMessage: 'invalid_settings',
      summary: '参加遅延フィルター設定の更新に失敗しました（無効な設定）',
    });
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateJoinDelayFilterSettings(settings);
  recordAuthenticatedAdminOperation(context, {
    action: 'filter.member.join_delay.update',
    category: 'settings',
    success: true,
    summary: '参加遅延フィルター設定を更新しました',
    metadata: { settings: updated },
  });
  return { ok: true, data: updated };
}
