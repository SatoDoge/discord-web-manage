import type {
  DupliFilterSettings,
  MesssegFilterSettings,
  ModerationFilterSettings,
  Settings,
  WordFilterSettings,
} from '#server/types/messageFilterSettings.js';

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

function isChannelListType(value: unknown): value is Settings['channelListType'] {
  return value === 'allow' || value === 'block';
}

function validateSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const settings = value as Record<string, unknown>;
  return (
    isBoolean(settings.isEnabled) &&
    isStringArray(settings.channelIdList) &&
    isChannelListType(settings.channelListType) &&
    isStringOrNull(settings.notificationChannelId) &&
    isBoolean(settings.banUser) &&
    isStringOrNull(settings.banReason) &&
    isNumberOrNull(settings.deleteMessageSeconds) &&
    isBoolean(settings.kickUser) &&
    isStringOrNull(settings.kickReason) &&
    isNumberOrNull(settings.kickSeconds) &&
    isBoolean(settings.giveRole) &&
    isStringOrNull(settings.roleId) &&
    isBoolean(settings.deleteMessage)
  );
}

export function isWordFilterSettings(value: unknown): value is WordFilterSettings {
  if (!validateSettings(value)) {
    return false;
  }

  const settings = value as WordFilterSettings;
  return isStringArray(settings.wordFilterList) && isStringArray(settings.urlFilterList);
}

export function isDupliFilterSettings(value: unknown): value is DupliFilterSettings {
  if (!validateSettings(value)) {
    return false;
  }

  const settings = value as DupliFilterSettings;
  return (
    isNumberOrNull(settings.duplicateMessagePerSeconds) &&
    isNumberOrNull(settings.duplicateMessagePer10Seconds) &&
    isNumberOrNull(settings.duplicateMessagePerMinutes) &&
    isBoolean(settings.isOnlySameContentMessage)
  );
}

export function isModerationFilterSettings(
  value: unknown,
): value is ModerationFilterSettings {
  if (!validateSettings(value)) {
    return false;
  }

  const settings = value as ModerationFilterSettings;
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
    isBoolean(settings.isFilterAppliedToContent) &&
    isBoolean(settings.isFilterAppliedToImage)
  );
}

export function isMessageFilterSettings(value: unknown): value is MesssegFilterSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const settings = value as MesssegFilterSettings;
  return (
    isWordFilterSettings(settings.wordFilterSettings) &&
    isDupliFilterSettings(settings.dupliFilterSettings) &&
    isModerationFilterSettings(settings.moderationFilterSettings)
  );
}
