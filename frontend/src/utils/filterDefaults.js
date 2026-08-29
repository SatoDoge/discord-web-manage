export const CHANNEL_LIST_TYPE_OPTIONS = [
    { label: 'Allow listed channels only', value: 'allow' },
    { label: 'Block listed channels', value: 'block' }
];

export const DELETE_MESSAGE_SECONDS_OPTIONS = [
    { label: 'Do not delete', value: 0 },
    { label: 'Previous 24 hours', value: 24 * 60 * 60 },
    { label: 'Previous 7 days', value: 7 * 24 * 60 * 60 }
];

export const MODERATION_CATEGORIES = [
    { key: 'harassment', label: 'Harassment' },
    { key: 'harassment/threatening', label: 'Harassment / Threatening' },
    { key: 'sexual', label: 'Sexual' },
    { key: 'hate', label: 'Hate' },
    { key: 'hate/threatening', label: 'Hate / Threatening' },
    { key: 'illicit', label: 'Illicit' },
    { key: 'illicit/violent', label: 'Illicit / Violent' },
    { key: 'self-harm/intent', label: 'Self-harm / Intent' },
    { key: 'self-harm/instructions', label: 'Self-harm / Instructions' },
    { key: 'self-harm', label: 'Self-harm' },
    { key: 'sexual/minors', label: 'Sexual / Minors' },
    { key: 'violence', label: 'Violence' },
    { key: 'violence/graphic', label: 'Violence / Graphic' }
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

export function linesToList(value) {
    return value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

export function listToLines(list) {
    return (list ?? []).join('\n');
}
