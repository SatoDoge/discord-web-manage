import type { Message } from "discord.js";
import { applyDupliFilter } from "#server/discord/filters/dupliFilter.js";
import { applyModerationFilter } from "#server/discord/filters/moderationFilter.js";
import { applyWordFilter } from "#server/discord/filters/wordFilter.js";
import {
    type FilterNotificationEntry,
    sendCombinedFilterNotification,
} from "#server/discord/notifications/sendFilterNotification.js";
import { toStoredGuildMessage } from "#server/discord/toStoredMessage.js";
import { addMessage, getMessageList } from "#server/stores/messageDataStore.js";
import {
    getDupliFilterSettings,
    getModerationFilterSettings,
    getWordFilterSettings,
} from "#server/stores/messageFilterSettingsStore.js";
import type { StoredGuildMessage } from "#server/types/messageData.js";
import type { Settings } from "#server/types/messageFilterSettings.js";
import { Logger } from "#server/utils/logger.js";

const logger = new Logger("discord.handlers.messageFilter");

type PendingNotification = FilterNotificationEntry & {
    notificationChannelId: string;
};

function isFilterApplicable(settings: Settings, channelId: string): boolean {
    if (!settings.isEnabled) {
        return false;
    }

    const inList = settings.channelIdList.includes(channelId);
    if (settings.channelListType === "block") {
        return !inList;
    }
    return inList;
}

function collectTriggeredNotifications(
    stored: StoredGuildMessage,
    wordFilterSettings: Settings,
    dupliFilterSettings: Settings,
    moderationFilterSettings: Settings,
): PendingNotification[] {
    const notifications: PendingNotification[] = [];

    if (stored.wordFilter?.isFiltered && wordFilterSettings.notificationChannelId) {
        const words = stored.wordFilter.filteredWords.join(", ") || "none";
        notifications.push({
            notificationChannelId: wordFilterSettings.notificationChannelId,
            label: "Word Filter",
            details: `Matched: ${words} (${stored.wordFilter.filteredWordCount})`,
        });
    }

    if (stored.dupliFilter?.isFiltered && dupliFilterSettings.notificationChannelId) {
        notifications.push({
            notificationChannelId: dupliFilterSettings.notificationChannelId,
            label: "Duplicate Filter",
            details: `Recent message count: ${stored.dupliFilter.messageCount}`,
        });
    }

    if (stored.moderationFilter?.isFiltered && moderationFilterSettings.notificationChannelId) {
        notifications.push({
            notificationChannelId: moderationFilterSettings.notificationChannelId,
            label: "Moderation Filter",
            details: `Flagged moderation results: ${stored.moderationFilter.messageCount}`,
        });
    }

    return notifications;
}

function groupNotificationsByChannel(
    notifications: PendingNotification[],
): Map<string, FilterNotificationEntry[]> {
    const grouped = new Map<string, FilterNotificationEntry[]>();

    for (const notification of notifications) {
        const entries = grouped.get(notification.notificationChannelId) ?? [];
        entries.push({
            label: notification.label,
            details: notification.details,
        });
        grouped.set(notification.notificationChannelId, entries);
    }

    return grouped;
}

async function sendGroupedNotifications(
    stored: StoredGuildMessage,
    notifications: PendingNotification[],
): Promise<void> {
    const grouped = groupNotificationsByChannel(notifications);

    for (const [notificationChannelId, entries] of grouped) {
        await sendCombinedFilterNotification(notificationChannelId, stored, entries);
    }
}

export async function handleMessageFilter(message: Message) {
    const syncedAt = new Date().toISOString();
    const stored = toStoredGuildMessage(message, syncedAt);

    const [wordFilterSettings, dupliFilterSettings, moderationFilterSettings, pastMessages] =
        await Promise.all([
            getWordFilterSettings(),
            getDupliFilterSettings(),
            getModerationFilterSettings(),
            getMessageList(),
        ]);

    if (isFilterApplicable(wordFilterSettings, stored.channelId)) {
        applyWordFilter(stored, wordFilterSettings);
    }

    if (isFilterApplicable(dupliFilterSettings, stored.channelId)) {
        applyDupliFilter(stored, dupliFilterSettings, pastMessages);
    }

    if (isFilterApplicable(moderationFilterSettings, stored.channelId)) {
        await applyModerationFilter(stored, moderationFilterSettings);
    }

    const notifications = collectTriggeredNotifications(
        stored,
        wordFilterSettings,
        dupliFilterSettings,
        moderationFilterSettings,
    );
    await sendGroupedNotifications(stored, notifications);

    try {
        await addMessage(stored);
    } catch (error) {
        logger.error(`Failed to save message ${stored.messageId}: ${String(error)}`);
    }
}
