import { getWordFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { WordFilterSettings } from '#server/types/messageFilterSettings.js';

export async function fetchWordFilterSettings(): Promise<WordFilterSettings> {
  return getWordFilterSettings();
}
