import type {
  JoinDelayFilterSettings,
  MemberFilterSettings,
  MemberProfileModerationFilterSettings,
  NameFilterSettings,
  Settings,
} from '#server/types/memberFilterSettings.js';

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateMemberSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const settings = value as Record<string, unknown>;
  return (
    isBoolean(settings.isEnabled) &&
    isStringOrNull(settings.notificationChannelId) &&
    isBoolean(settings.banUser) &&
    isStringOrNull(settings.banReason) &&
    isBoolean(settings.kickUser) &&
    isStringOrNull(settings.kickReason) &&
    isNumberOrNull(settings.kickSeconds) &&
    isBoolean(settings.giveRole) &&
    isStringOrNull(settings.roleId)
  );
}

export function isNameFilterSettings(value: unknown): value is NameFilterSettings {
  if (!validateMemberSettings(value)) {
    return false;
  }

  const settings = value as NameFilterSettings;
  return isStringArray(settings.nameFilterList);
}

export function isJoinDelayFilterSettings(
  value: unknown,
): value is JoinDelayFilterSettings {
  if (!validateMemberSettings(value)) {
    return false;
  }

  const settings = value as JoinDelayFilterSettings;
  return isNumberOrNull(settings.joinDelaySeconds);
}

export function isMemberProfileModerationFilterSettings(
  value: unknown,
): value is MemberProfileModerationFilterSettings {
  if (!validateMemberSettings(value)) {
    return false;
  }

  const settings = value as MemberProfileModerationFilterSettings;
  return (
    isBoolean(settings.isUseCustomFlag) &&
    isNumberOrNull(settings.harassment) &&
    isNumberOrNull(settings['harassment/threatening']) &&
    isNumberOrNull(settings.sexual) &&
    isNumberOrNull(settings.hate) &&
    isNumberOrNull(settings['hate/threatening']) &&
    isNumberOrNull(settings.illicit) &&
    isNumberOrNull(settings['illicit/violent']) &&
    isNumberOrNull(settings['self-harm/intent']) &&
    isNumberOrNull(settings['self-harm/instructions']) &&
    isNumberOrNull(settings['self-harm']) &&
    isNumberOrNull(settings['sexual/minors']) &&
    isNumberOrNull(settings.violence) &&
    isNumberOrNull(settings['violence/graphic']) &&
    isBoolean(settings.isFilterAppliedToName) &&
    isBoolean(settings.isFilterAppliedToIcon)
  );
}

export function isMemberFilterSettings(value: unknown): value is MemberFilterSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const settings = value as MemberFilterSettings;
  return (
    isNameFilterSettings(settings.nameFilterSettings) &&
    isJoinDelayFilterSettings(settings.joinDelayFilterSettings) &&
    isMemberProfileModerationFilterSettings(
      settings.memberProfileModerationFilterSettings,
    )
  );
}
