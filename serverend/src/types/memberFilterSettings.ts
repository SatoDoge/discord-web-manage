export type Settings = {
    isEnabled: boolean;
    notificationChannelId: string | null;
    banUser : boolean;
    banReason : string | null;
    kickUser : boolean;
    kickReason : string | null;
    kickSeconds : number | null;
    giveRole:boolean;
    roleId: string | null;
}

export type NameFilterSettings = Settings & {
    nameFilterList: string[];

}

export type JoinDelayFilterSettings = Settings & {
    joinDelaySeconds: number | null;
}

export type MemberProfileModerationFilterSettings = Settings & {
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
    isFilterAppliedToName: boolean;
    isFilterAppliedToIcon: boolean;
}

export type MemberFilterSettings = {
    nameFilterSettings: NameFilterSettings;
    joinDelayFilterSettings: JoinDelayFilterSettings;
    memberProfileModerationFilterSettings: MemberProfileModerationFilterSettings;
}

const baseSettings: Settings = {
    isEnabled: false,
    notificationChannelId: null,
    banUser: false,
    banReason: null,
    kickUser: false,
    kickReason: null,
    kickSeconds: null,
    giveRole: false,
    roleId: null,
};

export const memberFilterDefaultSettings: MemberFilterSettings = {
    nameFilterSettings: {
        ...baseSettings,
        nameFilterList: [],
    },
    joinDelayFilterSettings: {
        ...baseSettings,
        joinDelaySeconds: null,
    },
    memberProfileModerationFilterSettings: {
        ...baseSettings,
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
        isFilterAppliedToName: false,
        isFilterAppliedToIcon: false,
    },
};
