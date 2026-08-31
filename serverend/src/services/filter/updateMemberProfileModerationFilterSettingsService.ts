import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import { isMemberProfileModerationFilterSettings } from '#server/services/filter/validateMemberFilterSettings.js';
import { updateMemberProfileModerationFilterSettings } from '#server/stores/memberFilterSettingsStore.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { MemberProfileModerationFilterSettings } from '#server/types/memberFilterSettings.js';

export type UpdateMemberProfileModerationFilterSettingsResult =
  | { ok: true; data: MemberProfileModerationFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveMemberProfileModerationFilterSettings(
  settings: unknown,
  context: AuthenticatedServiceContext,
): Promise<UpdateMemberProfileModerationFilterSettingsResult> {
  if (!isMemberProfileModerationFilterSettings(settings)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'filter.member.profile_moderation.update',
      category: 'settings',
      success: false,
      errorMessage: 'invalid_settings',
      summary: 'メンバープロフィールモデレーションフィルター設定の更新に失敗しました（無効な設定）',
    });
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateMemberProfileModerationFilterSettings(settings);
  recordAuthenticatedAdminOperation(context, {
    action: 'filter.member.profile_moderation.update',
    category: 'settings',
    success: true,
    summary: 'メンバープロフィールモデレーションフィルター設定を更新しました',
    metadata: { settings: updated },
  });
  return { ok: true, data: updated };
}
