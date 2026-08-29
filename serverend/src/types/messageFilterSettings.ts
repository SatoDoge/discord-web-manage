export type Settings = {
    isEnabled: boolean;
    channelIdList: string[];
    channelListType: "allow" | "block";
    notificationChannelId: string | null;
    banUser : boolean;
    banReason : string | null;
    deleteMessageSeconds : number | null;
    kickUser : boolean;
    kickReason : string | null;
    kickSeconds : number | null;
    giveRole:boolean;
    roleId: string | null;
    deleteMessage: boolean;
}

export type WordFilterSettings = Settings & {
    wordFilterList: string[];
    urlFilterList: string[];
}

export type DupliFilterSettings = Settings & {
    duplicateMessagePerSeconds: number | null;
    duplicateMessagePer10Seconds: number | null;
    duplicateMessagePerMinutes: number | null;
    isOnlySameContentMessage: boolean;
}

export type ModerationFilterSettings = Settings & {
    isUseCustomFlag: boolean;
    harassment: number | null;
    'harassment/threatening': number | null;
    sexual: number | null;
    hate: number | null;
    'hate/threatening': number | null;
    illicit: number | null;
    'illicit/violent': number | null;
    'self-harm/intent': number | null;
    'self-harm/instructions': number | null;
    'self-harm': number | null;
    'sexual/minors': number | null;
    violence: number | null;
    'violence/graphic': number | null;
    isFilterAppliedToContent: boolean;
    isFilterAppliedToImage: boolean;
}

export type MesssegFilterSettings = {
    wordFilterSettings: WordFilterSettings;
    dupliFilterSettings: DupliFilterSettings;
    moderationFilterSettings: ModerationFilterSettings;
}

export const messageFilterDefaultSettings: MesssegFilterSettings = {
    wordFilterSettings: {
        isEnabled: false,
        channelIdList: [],
        channelListType: "block",
        notificationChannelId: null,
        banUser: false,
        banReason: null,
        deleteMessageSeconds: null,
        kickUser: false,
        kickReason: null,
        kickSeconds: null,
        giveRole: false,
        roleId: null,
        wordFilterList: [],
        urlFilterList: [],
        deleteMessage: false,
    },
    dupliFilterSettings: {
        isEnabled: false,
        channelIdList: [],
        channelListType: "block",
        notificationChannelId: null,
        banUser: false,
        banReason: null,
        deleteMessageSeconds: null,
        kickUser: false,
        kickReason: null,
        kickSeconds: null,
        giveRole: false,
        roleId: null,
        duplicateMessagePerSeconds: null,
        duplicateMessagePer10Seconds: null,
        duplicateMessagePerMinutes: null,
        isOnlySameContentMessage: true,
        deleteMessage: false,
    },
    moderationFilterSettings: {
        isEnabled: false,
        channelIdList: [],
        channelListType: "block",
        notificationChannelId: null,
        banUser: false,
        banReason: null,
        deleteMessageSeconds: null,
        kickUser: false,
        kickReason: null,
        kickSeconds: null,
        giveRole: false,
        roleId: null,
        isUseCustomFlag: false,
        harassment: null,
        'harassment/threatening': null,
        sexual: null,
        hate: null,
        'hate/threatening': null,
        illicit: null,
        'illicit/violent': null,
        'self-harm/intent': null,
        'self-harm/instructions': null,
        'self-harm': null,
        'sexual/minors': null,
        violence: null,
        'violence/graphic': null,
        isFilterAppliedToContent: false,
        isFilterAppliedToImage: false,
        deleteMessage: false,
    }
}