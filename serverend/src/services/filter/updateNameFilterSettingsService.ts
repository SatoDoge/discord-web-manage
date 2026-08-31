import { isNameFilterSettings } from '#server/services/filter/validateMemberFilterSettings.js';
import { updateNameFilterSettings } from '#server/stores/memberFilterSettingsStore.js';
import type { NameFilterSettings } from '#server/types/memberFilterSettings.js';

export type UpdateNameFilterSettingsResult =
  | { ok: true; data: NameFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveNameFilterSettings(
  settings: unknown,
): Promise<UpdateNameFilterSettingsResult> {
  if (!isNameFilterSettings(settings)) {
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateNameFilterSettings(settings);
  return { ok: true, data: updated };
}
