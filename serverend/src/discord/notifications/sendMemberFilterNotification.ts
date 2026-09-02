import { EmbedBuilder } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord.notifications.sendMemberFilterNotification');

export type MemberFilterNotificationEntry = {
    label: string;
    details: string;
};

function getMemberLabel(stored: StoredMemberJoinEvent): string {
    return stored.displayName ?? stored.globalName ?? stored.username;
}

export function buildMemberFilterNotificationEmbed(
    stored: StoredMemberJoinEvent,
    entries: MemberFilterNotificationEntry[],
): EmbedBuilder {
    const profileUrl = `https://discord.com/users/${stored.userId}`;
    const memberLabel = getMemberLabel(stored);

    const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('Member Filter Triggered')
        .setURL(profileUrl)
        .setAuthor({
            name: memberLabel,
            iconURL: stored.avatarURL,
            url: profileUrl,
        })
        .addFields(
            { name: 'User', value: `<@${stored.userId}>`, inline: true },
            {
                name: 'Account Created',
                value: `<t:${Math.floor(new Date(stored.accountCreatedAt).getTime() / 1_000)}:R>`,
                inline: true,
            },
            {
                name: 'Joined',
                value: `<t:${Math.floor(new Date(stored.joinedAt).getTime() / 1_000)}:R>`,
                inline: true,
            },
        )
        .setTimestamp(new Date(stored.joinedAt))
        .setFooter({ text: `User ID: ${stored.userId}` });

    for (const entry of entries) {
        embed.addFields({
            name: entry.label,
            value: entry.details.slice(0, 1024),
            inline: false,
        });
    }

    return embed;
}

export async function sendCombinedMemberFilterNotification(
    notificationChannelId: string,
    stored: StoredMemberJoinEvent,
    entries: MemberFilterNotificationEntry[],
): Promise<void> {
    if (entries.length === 0) {
        return;
    }

    const client = getDiscordClient();
    if (!client?.isReady()) {
        logger.warn('Cannot send member filter notification: Discord client is not ready');
        return;
    }

    try {
        const channel = await client.channels.fetch(notificationChannelId);
        if (!channel?.isTextBased() || channel.isDMBased()) {
            logger.warn(
                `Cannot send member filter notification: channel ${notificationChannelId} is not a guild text channel`,
            );
            return;
        }

        const embed = buildMemberFilterNotificationEmbed(stored, entries);
        await channel.send({ embeds: [embed] });
    } catch (error) {
        logger.error(`Failed to send member filter notification: ${String(error)}`);
    }
}
