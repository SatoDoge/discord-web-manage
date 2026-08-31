import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { isModerationFilterSettings } from '#server/services/filter/validateFilterSettings.js';
import { updateModerationFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { ModerationFilterSettings } from '#server/types/messageFilterSettings.js';

export type UpdateModerationFilterSettingsResult =
  | { ok: true; data: ModerationFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveModerationFilterSettings(
  settings: unknown,
  context: AuthenticatedServiceContext,
): Promise<UpdateModerationFilterSettingsResult> {
  if (!isModerationFilterSettings(settings)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'filter.moderation.update',
      category: 'settings',
      success: false,
      errorMessage: 'invalid_settings',
      summary: 'モデレーションフィルター設定の更新に失敗しました（無効な設定）',
    });
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateModerationFilterSettings(settings);
  recordAuthenticatedAdminOperation(context, {
    action: 'filter.moderation.update',
    category: 'settings',
    success: true,
    summary: 'モデレーションフィルター設定を更新しました',
    metadata: { settings: updated },
  });
  return { ok: true, data: updated };
}
