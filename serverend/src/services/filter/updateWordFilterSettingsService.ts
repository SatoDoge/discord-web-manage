import { isWordFilterSettings } from '#server/services/filter/validateFilterSettings.js';
import { updateWordFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { WordFilterSettings } from '#server/types/messageFilterSettings.js';

export type UpdateWordFilterSettingsResult =
  | { ok: true; data: WordFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveWordFilterSettings(
  settings: unknown,
): Promise<UpdateWordFilterSettingsResult> {
  if (!isWordFilterSettings(settings)) {
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateWordFilterSettings(settings);
  return { ok: true, data: updated };
}
