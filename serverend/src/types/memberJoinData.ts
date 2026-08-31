import type OpenAI from 'openai';
import type { MeasuredMessage } from '#server/types/messageData.js';

export type memberNameFilter = {
    isFiltered: boolean;
    matchedWords: string[];
    blockedWords: string[];
    matchCount: number;
};

export type joinDelayFilter = {
    isFiltered: boolean;
    accountAgeSeconds: number;
    requiredDelaySeconds: number;
};

export type memberProfileModerationFilter = {
    isFiltered: boolean;
    flaggedCount: number;
};

export type memberProfileModerationImage = {
    url: string;
    moderation:
        OpenAI.Moderations.ModerationCreateResponse['results'][number] | null;
};

export type memberProfileModerationDetail = {
    name:
        OpenAI.Moderations.ModerationCreateResponse['results'][number] | null;
    icon: memberProfileModerationImage | null;
};

export type StoredMemberJoinEvent = {
    joinEventId: string;
    userId: string;
    guildId: string;

    username: string;
    globalName: string | null;
    displayName: string;
    nickname: string | null;
    avatarURL: string;
    bot: boolean;

    accountCreatedAt: string;
    joinedAt: string;

    firstSeenAt: string;
    lastSyncedAt: string;

    nameFilter: memberNameFilter | null;
    joinDelayFilter: joinDelayFilter | null;
    memberProfileModerationFilter: memberProfileModerationFilter | null;
    memberProfileModerationDetail: memberProfileModerationDetail | null;

    isFiltered: boolean;
    isMeasured: boolean;
    measuredMessage: MeasuredMessage[] | null;
};

export type StoredMemberJoinEventList = StoredMemberJoinEvent[];
