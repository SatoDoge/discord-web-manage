import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { isWordFilterSettings } from '#server/services/filter/validateFilterSettings.js';
import { updateWordFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { WordFilterSettings } from '#server/types/messageFilterSettings.js';

export type UpdateWordFilterSettingsResult =
  | { ok: true; data: WordFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveWordFilterSettings(
  settings: unknown,
  context: AuthenticatedServiceContext,
): Promise<UpdateWordFilterSettingsResult> {
  if (!isWordFilterSettings(settings)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'filter.word.update',
      category: 'settings',
      success: false,
      errorMessage: 'invalid_settings',
      summary: 'ワードフィルター設定の更新に失敗しました（無効な設定）',
    });
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateWordFilterSettings(settings);
  recordAuthenticatedAdminOperation(context, {
    action: 'filter.word.update',
    category: 'settings',
    success: true,
    summary: 'ワードフィルター設定を更新しました',
    metadata: { settings: updated },
  });
  return { ok: true, data: updated };
}
