import { isMessageFilterSettings } from '#server/services/filter/validateFilterSettings.js';
import { setMessageFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { MesssegFilterSettings } from '#server/types/messageFilterSettings.js';

export type UpdateFilterSettingsResult =
  | { ok: true; data: MesssegFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function updateMessageFilterSettings(
  settings: unknown,
): Promise<UpdateFilterSettingsResult> {
  if (!isMessageFilterSettings(settings)) {
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await setMessageFilterSettings(settings);
  return { ok: true, data: updated };
}
