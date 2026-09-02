import { getMessageFilterSettings } from '#server/stores/messageFilterSettingsStore.js';
import type { MesssegFilterSettings } from '#server/types/messageFilterSettings.js';

export async function fetchMessageFilterSettings(): Promise<MesssegFilterSettings> {
  return getMessageFilterSettings();
}
