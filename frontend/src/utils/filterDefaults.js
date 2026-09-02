export const MODERATION_CATEGORIES = [
    { key: 'harassment', i18nKey: 'harassment' },
    { key: 'harassment/threatening', i18nKey: 'harassmentThreatening' },
    { key: 'sexual', i18nKey: 'sexual' },
    { key: 'hate', i18nKey: 'hate' },
    { key: 'hate/threatening', i18nKey: 'hateThreatening' },
    { key: 'illicit', i18nKey: 'illicit' },
    { key: 'illicit/violent', i18nKey: 'illicitViolent' },
    { key: 'self-harm/intent', i18nKey: 'selfHarmIntent' },
    { key: 'self-harm/instructions', i18nKey: 'selfHarmInstructions' },
    { key: 'self-harm', i18nKey: 'selfHarm' },
    { key: 'sexual/minors', i18nKey: 'sexualMinors' },
    { key: 'violence', i18nKey: 'violence' },
    { key: 'violence/graphic', i18nKey: 'violenceGraphic' }
];

export function createBaseFilterSettings() {
    return {
        isEnabled: false,
        channelIdList: [],
        channelListType: 'block',
        notificationChannelId: null,
        banUser: false,
        banReason: null,
        deleteMessageSeconds: null,
        kickUser: false,
        kickReason: null,
        kickSeconds: null,
        giveRole: false,
        roleId: null,
        deleteMessage: false
    };
}

export function createWordFilterSettings() {
    return {
        ...createBaseFilterSettings(),
        wordFilterList: [],
        urlFilterList: []
    };
}

export function createDupliFilterSettings() {
    return {
        ...createBaseFilterSettings(),
        duplicateMessagePerSeconds: null,
        duplicateMessagePer10Seconds: null,
        duplicateMessagePerMinutes: null,
        isOnlySameContentMessage: true
    };
}

export function createModerationFilterSettings() {
    const settings = {
        ...createBaseFilterSettings(),
        isUseCustomFlag: false,
        isFilterAppliedToContent: false,
        isFilterAppliedToImage: false
    };

    for (const category of MODERATION_CATEGORIES) {
        settings[category.key] = null;
    }

    return settings;
}

export function createMemberBaseFilterSettings() {
    return {
        isEnabled: false,
        notificationChannelId: null,
        banUser: false,
        banReason: null,
        kickUser: false,
        kickReason: null,
        kickSeconds: null,
        giveRole: false,
        roleId: null
    };
}

export function createMemberNameFilterSettings() {
    return {
        ...createMemberBaseFilterSettings(),
        nameFilterList: []
    };
}

export function createMemberJoinDelayFilterSettings() {
    return {
        ...createMemberBaseFilterSettings(),
        joinDelaySeconds: null
    };
}

export function createMemberProfileModerationFilterSettings() {
    const settings = {
        ...createMemberBaseFilterSettings(),
        isUseCustomFlag: false,
        isFilterAppliedToName: false,
        isFilterAppliedToIcon: false
    };

    for (const category of MODERATION_CATEGORIES) {
        settings[category.key] = null;
    }

    return settings;
}

export function linesToList(value) {
    return value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

export function listToLines(list) {
    return (list ?? []).join('\n');
}
