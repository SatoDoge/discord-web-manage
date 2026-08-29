import { isModerationFilterSettings } from '#server/services/filter/validateFilterSettings.js';
import { updateModerationFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { ModerationFilterSettings } from '#server/types/messageFilterSettings.js';

export type UpdateModerationFilterSettingsResult =
  | { ok: true; data: ModerationFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveModerationFilterSettings(
  settings: unknown,
): Promise<UpdateModerationFilterSettingsResult> {
  if (!isModerationFilterSettings(settings)) {
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateModerationFilterSettings(settings);
  return { ok: true, data: updated };
}
