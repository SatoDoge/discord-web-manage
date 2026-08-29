import { isDupliFilterSettings } from '#server/services/filter/validateFilterSettings.js';
import { updateDupliFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { DupliFilterSettings } from '#server/types/messageFilterSettings.js';

export type UpdateDupliFilterSettingsResult =
  | { ok: true; data: DupliFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveDupliFilterSettings(
  settings: unknown,
): Promise<UpdateDupliFilterSettingsResult> {
  if (!isDupliFilterSettings(settings)) {
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateDupliFilterSettings(settings);
  return { ok: true, data: updated };
}
