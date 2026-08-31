import type { GuildMember } from 'discord.js';
import { applyJoinDelayFilter } from '#server/discord/filters/joinDelayFilter.js';
import { applyMemberProfileModerationFilter } from '#server/discord/filters/memberProfileModerationFilter.js';
import { applyNameFilter } from '#server/discord/filters/nameFilter.js';
import { executeMemberFilterMeasures } from '#server/discord/handlers/executeMemberFilterMeasures.js';
import {
    type MemberFilterNotificationEntry,
    sendCombinedMemberFilterNotification,
} from '#server/discord/notifications/sendMemberFilterNotification.js';
import { toStoredMemberJoinEvent } from '#server/discord/toStoredMemberJoin.js';
import { addMemberJoinEvent } from '#server/stores/memberJoinDataStore.js';
import {
    getJoinDelayFilterSettings,
    getMemberProfileModerationFilterSettings,
    getNameFilterSettings,
} from '#server/stores/memberFilterSettingsStore.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';
import type { Settings } from '#server/types/memberFilterSettings.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord.handlers.memberFilter');

type PendingNotification = MemberFilterNotificationEntry & {
    notificationChannelId: string;
};

function collectTriggeredNotifications(
    stored: StoredMemberJoinEvent,
    nameFilterSettings: Settings,
    joinDelayFilterSettings: Settings,
    memberProfileModerationFilterSettings: Settings,
): PendingNotification[] {
    const notifications: PendingNotification[] = [];

    if (stored.nameFilter?.isFiltered && nameFilterSettings.notificationChannelId) {
        const words = stored.nameFilter.matchedWords.join(', ') || 'none';
        notifications.push({
            notificationChannelId: nameFilterSettings.notificationChannelId,
            label: 'Name Filter',
            details: `Matched: ${words} (${stored.nameFilter.matchCount})`,
        });
    }

    if (stored.joinDelayFilter?.isFiltered && joinDelayFilterSettings.notificationChannelId) {
        notifications.push({
            notificationChannelId: joinDelayFilterSettings.notificationChannelId,
            label: 'Join Delay Filter',
            details: `Account age: ${stored.joinDelayFilter.accountAgeSeconds}s (required: ${stored.joinDelayFilter.requiredDelaySeconds}s)`,
        });
    }

    if (
        stored.memberProfileModerationFilter?.isFiltered &&
        memberProfileModerationFilterSettings.notificationChannelId
    ) {
        notifications.push({
            notificationChannelId:
                memberProfileModerationFilterSettings.notificationChannelId,
            label: 'Profile Moderation Filter',
            details: `Flagged moderation results: ${stored.memberProfileModerationFilter.flaggedCount}`,
        });
    }

    return notifications;
}

function groupNotificationsByChannel(
    notifications: PendingNotification[],
): Map<string, MemberFilterNotificationEntry[]> {
    const grouped = new Map<string, MemberFilterNotificationEntry[]>();

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
    stored: StoredMemberJoinEvent,
    notifications: PendingNotification[],
): Promise<void> {
    const grouped = groupNotificationsByChannel(notifications);

    for (const [notificationChannelId, entries] of grouped) {
        await sendCombinedMemberFilterNotification(
            notificationChannelId,
            stored,
            entries,
        );
    }
}

export async function handleMemberFilter(member: GuildMember): Promise<void> {
    if (member.user.bot) {
        return;
    }

    const syncedAt = new Date().toISOString();
    const stored = toStoredMemberJoinEvent(member, syncedAt);

    const [nameFilterSettings, joinDelayFilterSettings, memberProfileModerationFilterSettings] =
        await Promise.all([
            getNameFilterSettings(),
            getJoinDelayFilterSettings(),
            getMemberProfileModerationFilterSettings(),
        ]);

    if (nameFilterSettings.isEnabled) {
        applyNameFilter(stored, nameFilterSettings);
    }

    if (joinDelayFilterSettings.isEnabled) {
        applyJoinDelayFilter(stored, joinDelayFilterSettings);
    }

    if (memberProfileModerationFilterSettings.isEnabled) {
        await applyMemberProfileModerationFilter(
            stored,
            memberProfileModerationFilterSettings,
        );
    }

    const triggeredSettings: Settings[] = [];

    if (stored.nameFilter?.isFiltered && nameFilterSettings.isEnabled) {
        triggeredSettings.push(nameFilterSettings);
    }

    if (stored.joinDelayFilter?.isFiltered && joinDelayFilterSettings.isEnabled) {
        triggeredSettings.push(joinDelayFilterSettings);
    }

    if (
        stored.memberProfileModerationFilter?.isFiltered &&
        memberProfileModerationFilterSettings.isEnabled
    ) {
        triggeredSettings.push(memberProfileModerationFilterSettings);
    }

    stored.isFiltered = triggeredSettings.length > 0;

    await executeMemberFilterMeasures(stored, triggeredSettings);

    const notifications = collectTriggeredNotifications(
        stored,
        nameFilterSettings,
        joinDelayFilterSettings,
        memberProfileModerationFilterSettings,
    );
    await sendGroupedNotifications(stored, notifications);

    try {
        await addMemberJoinEvent(stored);
    } catch (error) {
        logger.error(
            `Failed to save member join event ${stored.joinEventId}: ${String(error)}`,
        );
    }
}
