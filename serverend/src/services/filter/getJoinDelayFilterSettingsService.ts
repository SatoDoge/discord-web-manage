import { getJoinDelayFilterSettings } from '#server/stores/memberFilterSettingsStore.js';
import type { JoinDelayFilterSettings } from '#server/types/memberFilterSettings.js';

export async function fetchJoinDelayFilterSettings(): Promise<JoinDelayFilterSettings> {
  return getJoinDelayFilterSettings();
}
