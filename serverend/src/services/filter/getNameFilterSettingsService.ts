import { getNameFilterSettings } from '#server/stores/memberFilterSettingsStore.js';
import type { NameFilterSettings } from '#server/types/memberFilterSettings.js';

export async function fetchNameFilterSettings(): Promise<NameFilterSettings> {
  return getNameFilterSettings();
}
