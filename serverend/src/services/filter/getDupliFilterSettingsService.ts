import { getDupliFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { DupliFilterSettings } from '#server/types/messageFilterSettings.js';

export async function fetchDupliFilterSettings(): Promise<DupliFilterSettings> {
  return getDupliFilterSettings();
}
