import { isMemberProfileModerationFilterSettings } from '#server/services/filter/validateMemberFilterSettings.js';
import { updateMemberProfileModerationFilterSettings } from '#server/stores/memberFilterSettingsStore.js';
import type { MemberProfileModerationFilterSettings } from '#server/types/memberFilterSettings.js';

export type UpdateMemberProfileModerationFilterSettingsResult =
  | { ok: true; data: MemberProfileModerationFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveMemberProfileModerationFilterSettings(
  settings: unknown,
): Promise<UpdateMemberProfileModerationFilterSettingsResult> {
  if (!isMemberProfileModerationFilterSettings(settings)) {
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateMemberProfileModerationFilterSettings(settings);
  return { ok: true, data: updated };
}
