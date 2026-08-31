import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { isDupliFilterSettings } from '#server/services/filter/validateFilterSettings.js';
import { updateDupliFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { DupliFilterSettings } from '#server/types/messageFilterSettings.js';

export type UpdateDupliFilterSettingsResult =
  | { ok: true; data: DupliFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveDupliFilterSettings(
  settings: unknown,
  context: AuthenticatedServiceContext,
): Promise<UpdateDupliFilterSettingsResult> {
  if (!isDupliFilterSettings(settings)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'filter.dupli.update',
      category: 'settings',
      success: false,
      errorMessage: 'invalid_settings',
      summary: '重複メッセージフィルター設定の更新に失敗しました（無効な設定）',
    });
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateDupliFilterSettings(settings);
  recordAuthenticatedAdminOperation(context, {
    action: 'filter.dupli.update',
    category: 'settings',
    success: true,
    summary: '重複メッセージフィルター設定を更新しました',
    metadata: { settings: updated },
  });
  return { ok: true, data: updated };
}
