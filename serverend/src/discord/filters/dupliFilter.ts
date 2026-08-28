import { getMessageList } from "#server/stores/messageDataStore.js";
import { getDupliFilterSettings } from "#server/stores/messageFilterSettingsStore.js";
import type { StoredGuildMessage } from "#server/types/messageData.js";
import type { DupliFilterSettings } from "#server/types/messageFilterSettings.js";

const ONE_SECOND_MS = 1_000;
const TEN_SECONDS_MS = 10_000;
const ONE_MINUTE_MS = 60_000;

function getMessageContentKey(message: StoredGuildMessage): string {
    return message.cleanContent.trim() || message.content.trim();
}

function getUserMessages(
    pastMessages: StoredGuildMessage[],
    message: StoredGuildMessage,
): StoredGuildMessage[] {
    return pastMessages.filter(
        (entry) =>
            entry.author.userId === message.author.userId &&
            entry.guildId === message.guildId &&
            entry.deletedAt === null,
    );
}

function countMessagesInWindow(
    userMessages: StoredGuildMessage[],
    current: StoredGuildMessage,
    windowMs: number,
    onlySameContent: boolean,
): number {
    const currentTime = new Date(current.createdAt).getTime();
    const windowStart = currentTime - windowMs;

    const inWindow = userMessages.filter((entry) => {
        const createdAt = new Date(entry.createdAt).getTime();
        return createdAt >= windowStart && createdAt <= currentTime;
    });

    const includesCurrent = inWindow.some((entry) => entry.messageId === current.messageId);
    const candidates = includesCurrent ? inWindow : [...inWindow, current];

    if (!onlySameContent) {
        return candidates.length;
    }

    const contentKey = getMessageContentKey(current);
    return candidates.filter((entry) => getMessageContentKey(entry) === contentKey).length;
}

function exceedsThreshold(count: number, limit: number | null): boolean {
    return limit !== null && count > limit;
}

export function applyDupliFilter(
    message: StoredGuildMessage,
    dupliFilterSettings: DupliFilterSettings,
    pastMessages: StoredGuildMessage[],
): void {
    const userMessages = getUserMessages(pastMessages, message);
    const onlySameContent = dupliFilterSettings.isOnlySameContentMessage;

    const windowChecks: { count: number; limit: number | null }[] = [];

    if (dupliFilterSettings.duplicateMessagePerSeconds !== null) {
        windowChecks.push({
            count: countMessagesInWindow(userMessages, message, ONE_SECOND_MS, onlySameContent),
            limit: dupliFilterSettings.duplicateMessagePerSeconds,
        });
    }

    if (dupliFilterSettings.duplicateMessagePer10Seconds !== null) {
        windowChecks.push({
            count: countMessagesInWindow(userMessages, message, TEN_SECONDS_MS, onlySameContent),
            limit: dupliFilterSettings.duplicateMessagePer10Seconds,
        });
    }

    if (dupliFilterSettings.duplicateMessagePerMinutes !== null) {
        windowChecks.push({
            count: countMessagesInWindow(userMessages, message, ONE_MINUTE_MS, onlySameContent),
            limit: dupliFilterSettings.duplicateMessagePerMinutes,
        });
    }

    if (windowChecks.length === 0) {
        message.dupliFilter = {
            isFiltered: false,
            messageCount: 0,
        };
        return;
    }

    const isFiltered = windowChecks.some(({ count, limit }) => exceedsThreshold(count, limit));
    const messageCount = isFiltered
        ? Math.max(...windowChecks.filter(({ count, limit }) => exceedsThreshold(count, limit)).map(({ count }) => count))
        : Math.max(...windowChecks.map(({ count }) => count));

    message.dupliFilter = {
        isFiltered,
        messageCount,
    };
}

export async function handleDupliFilter(message: StoredGuildMessage) {
    const dupliFilterSettings = await getDupliFilterSettings();
    if (!dupliFilterSettings.isEnabled) return;
    if (
        (dupliFilterSettings.channelIdList.includes(message.channelId) &&
            dupliFilterSettings.channelListType === "block") ||
        (!dupliFilterSettings.channelIdList.includes(message.channelId) &&
            dupliFilterSettings.channelListType === "allow")
    ) {
        return;
    }

    const pastMessages = await getMessageList();
    applyDupliFilter(message, dupliFilterSettings, pastMessages);
}
