import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { isMessageFilterSettings } from '#server/services/filter/validateFilterSettings.js';
import { setMessageFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { MesssegFilterSettings } from '#server/types/messageFilterSettings.js';

export type UpdateFilterSettingsResult =
  | { ok: true; data: MesssegFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function updateMessageFilterSettings(
  settings: unknown,
  context: AuthenticatedServiceContext,
): Promise<UpdateFilterSettingsResult> {
  if (!isMessageFilterSettings(settings)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'filter.message.update',
      category: 'settings',
      success: false,
      errorMessage: 'invalid_settings',
      summary: 'メッセージフィルター設定の更新に失敗しました（無効な設定）',
    });
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await setMessageFilterSettings(settings);
  recordAuthenticatedAdminOperation(context, {
    action: 'filter.message.update',
    category: 'settings',
    success: true,
    summary: 'メッセージフィルター設定を更新しました',
    metadata: { settings: updated },
  });
  return { ok: true, data: updated };
}
