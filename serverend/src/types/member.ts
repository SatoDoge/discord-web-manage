import type { ActivityType } from "discord.js";

export type StoredRole = {
    id: string;
    name: string;

    color: number;
    hexColor: string;

    position: number;
    permissions: string;

    managed: boolean;
    hoist: boolean;
    mentionable: boolean;

    iconURL: string | null;
    unicodeEmoji: string | null;
};

export type StoredActivity = {
    name: string;
    type: ActivityType;

    state: string | null;
    details: string | null;

    url: string | null;
    applicationId: string | null;

    startedAt: string | null;
    endedAt: string | null;

    emoji: {
        id: string | null;
        name: string | null;
        animated: boolean;
    } | null;
};

export type StoredPresence = {
    status: "online" | "idle" | "dnd" | "offline";

    activities: StoredActivity[];

    clientStatus: {
        desktop: "online" | "idle" | "dnd" | null;
        mobile: "online" | "idle" | "dnd" | null;
        web: "online" | "idle" | "dnd" | null;
    } | null;

    // Discordから最後にPresenceを受け取った日時
    updatedAt: string;
};

export type StoredGuildMember = {
    id: string;

    // Discord全体のユーザー情報
    username: string;
    globalName: string | null;

    avatarHash: string | null;
    avatarURL: string;

    bannerHash: string | null | undefined;
    bannerURL: string | null | undefined;

    bot: boolean;
    system: boolean;

    // Discord Snowflakeから取得できるアカウント作成日時
    accountCreatedAt: string;

    // このギルド内だけの情報
    displayName: string;
    nickname: string | null;

    guildAvatarHash: string | null;
    guildAvatarURL: string | null;

    guildBannerHash: string | null;
    guildBannerURL: string | null;

    roles: StoredRole[];

    joinedAt: string | null;
    premiumSince: string | null;

    pending: boolean | null;
    communicationDisabledUntil: string | null;

    // GuildMemberFlagsBitField#bitfield を数値化したもの
    flags: number;

    // Presence Intentを有効化している場合だけ持つ
    presence: StoredPresence | null;

    // 自分のDB上での管理用時刻
    firstSeenAt: string;
    profileUpdatedAt: string;
    memberUpdatedAt: string;
    lastSyncedAt: string;
};

export type StoredGuildMemberList = StoredGuildMember[];

/** Profile/member fields only (presence is managed separately). */
export type StoredGuildMemberWithoutPresence = Omit<StoredGuildMember, 'presence'>;