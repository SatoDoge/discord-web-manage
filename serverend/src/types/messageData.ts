import OpenAI from "openai";
export type StoredMessageAuthor = {
    userId: string;
    username: string;
    globalName: string | null;

    avatarURL: string;
    bot: boolean;
    system: boolean;

    // 投稿時点のギルド内表示名。退出済み等で取れない場合はnull
    displayName: string | null;
};

export type StoredMessageAttachment = {
    attachmentId: string;

    filename: string | null;
    description: string | null;

    contentType: string | null; // "image/png", "application/pdf" など
    size: number; // bytes

    url: string;
    proxyURL: string;

    width: number | null;
    height: number | null;
    duration: number | null; // 音声・動画の長さ（秒）

    spoiler: boolean;
    ephemeral: boolean;
};

export type StoredMessageEmbedField = {
    name: string;
    value: string;
    inline: boolean;
};

export type StoredMessageEmbed = {
    type: string | null;

    title: string | null;
    description: string | null;
    url: string | null;
    color: number | null;

    timestamp: string | null;

    author: {
        name: string;
        url: string | null;
        iconURL: string | null;
    } | null;

    footer: {
        text: string;
        iconURL: string | null;
    } | null;

    imageURL: string | null;
    thumbnailURL: string | null;

    videoURL: string | null;
    videoWidth: number | null;
    videoHeight: number | null;

    provider: {
        name: string | null;
        url: string | null;
    } | null;

    fields: StoredMessageEmbedField[];
};

export type StoredMessageMention = {
    userIds: string[];
    roleIds: string[];
    channelIds: string[];

    everyone: boolean;
    here: boolean;
};

export type StoredMessageReaction = {
    emojiId: string | null;
    emojiName: string | null;
    emojiAnimated: boolean | null;

    count: number;
    me: boolean;
};

export type StoredMessageReference = {
    messageId: string | null;
    channelId: string | null;
    guildId: string | null;
} | null;

export type wordFilter = {
    isFiltered: boolean;
    filteredWords: string[];
    filteredWordCount: number;
    blockedWords: string[];
    blockedUrlPatterns: string[];
    matchedUrls: string[];
};

export type dupliFilterWindow = {
    window: "1s" | "10s" | "1m";
    count: number;
    limit: number;
    exceeded: boolean;
};

export type dupliFilter = {
    isFiltered: boolean;
    messageCount: number;
    onlySameContent: boolean;
    windows: dupliFilterWindow[];
};

export type moderationFilter = {
    isFiltered: boolean;
    messageCount: number;
};

export type moderationImage = {
    url: string;
    moderation:
        OpenAI.Moderations.ModerationCreateResponse["results"][number] | null;
};

export type multipleMessageFilter = {
    content:
        OpenAI.Moderations.ModerationCreateResponse["results"][number] | null;
    image: moderationImage[] | null;
};

export type MeasuredMessage = {
    command: "ban" | "kick" | "role" | "delete" | "none";
    operationUserId: string;
    banDetail: {
        reason: string;
        deleteMessageSeconds: number;
    } | null;
    kickDetail: {
        reason: string;
        kickSeconds: number;
    } | null;
    roleDetail: {
        roleId: string;
    } | null;
    deleteDetail: {
        isDeleted: boolean;
    } | null;
    measuredAt: string; // 実行完了日時
};

export type StoredGuildMessage = {
    // DB上の主キーにできる。Discord全体で一意
    messageId: string;

    guildId: string;
    channelId: string;

    author: StoredMessageAuthor;

    // 本文・構造
    content: string;
    cleanContent: string;

    messageType: number;
    flags: string; // BitFieldは文字列として保存
    tts: boolean;
    pinned: boolean;

    attachments: StoredMessageAttachment[];
    embeds: StoredMessageEmbed[];
    mentions: StoredMessageMention;
    reactions: StoredMessageReaction[];

    stickers: {
        stickerId: string;
        name: string;
        formatType: number;
    }[];

    // 返信・転送元
    reference: StoredMessageReference;

    // 投稿に紐づくスレッドがあるか
    hasThread: boolean;
    threadId: string | null;

    // Webhook・スラッシュコマンドなどの識別
    webhookId: string | null;
    applicationId: string | null;

    // Discord上の日時
    createdAt: string;
    editedAt: string | null;

    // Botが保存・同期した日時
    firstSeenAt: string;
    lastSyncedAt: string;

    // messageDeleteを受けたら値を入れ、レコード自体は残す想定
    deletedAt: string | null;

    // 削除フラグ
    isDeleted: boolean;

    // チェック
    wordFilter: wordFilter | null;
    dupliFilter: dupliFilter | null;
    moderationFilter: moderationFilter | null;
    multipleMessageFilter: multipleMessageFilter | null;
    isFiltered: boolean;
    isMeasured: boolean;
    measuredMessage: MeasuredMessage[] | null;
};

export type StoredGuildMessageList = StoredGuildMessage[];
