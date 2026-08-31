import { isJoinDelayFilterSettings } from '#server/services/filter/validateMemberFilterSettings.js';
import { updateJoinDelayFilterSettings } from '#server/stores/memberFilterSettingsStore.js';
import type { JoinDelayFilterSettings } from '#server/types/memberFilterSettings.js';

export type UpdateJoinDelayFilterSettingsResult =
  | { ok: true; data: JoinDelayFilterSettings }
  | { ok: false; error: 'invalid_settings' };

export async function saveJoinDelayFilterSettings(
  settings: unknown,
): Promise<UpdateJoinDelayFilterSettingsResult> {
  if (!isJoinDelayFilterSettings(settings)) {
    return { ok: false, error: 'invalid_settings' };
  }

  const updated = await updateJoinDelayFilterSettings(settings);
  return { ok: true, data: updated };
}
