import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { isNameFilterSettings } from '#server/services/filter/validateMemberFilterSettings.js';
import { updateNameFilterSettings } from '#server/stores/memberFilterSettingsStore.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { NameFilterSettings } from '#server/types/memberFilterSettings.js';

export type UpdateNameFilterSettingsResult =
  | { ok: true; data: NameFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveNameFilterSettings(
  settings: unknown,
  context: AuthenticatedServiceContext,
): Promise<UpdateNameFilterSettingsResult> {
  if (!isNameFilterSettings(settings)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'filter.member.name.update',
      category: 'settings',
      success: false,
      errorMessage: 'invalid_settings',
      summary: 'メンバー名フィルター設定の更新に失敗しました（無効な設定）',
    });
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateNameFilterSettings(settings);
  recordAuthenticatedAdminOperation(context, {
    action: 'filter.member.name.update',
    category: 'settings',
    success: true,
    summary: 'メンバー名フィルター設定を更新しました',
    metadata: { settings: updated },
  });
  return { ok: true, data: updated };
}
