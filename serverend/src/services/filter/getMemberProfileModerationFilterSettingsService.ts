import { getMemberProfileModerationFilterSettings } from '#server/stores/memberFilterSettingsStore.js';
import type { MemberProfileModerationFilterSettings } from '#server/types/memberFilterSettings.js';

export async function fetchMemberProfileModerationFilterSettings(): Promise<MemberProfileModerationFilterSettings> {
  return getMemberProfileModerationFilterSettings();
}
