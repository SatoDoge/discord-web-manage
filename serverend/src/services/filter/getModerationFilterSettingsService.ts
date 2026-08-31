import { getModerationFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { ModerationFilterSettings } from '#server/types/messageFilterSettings.js';

export async function fetchModerationFilterSettings(): Promise<ModerationFilterSettings> {
  return getModerationFilterSettings();
}
