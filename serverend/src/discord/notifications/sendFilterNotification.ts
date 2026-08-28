import { EmbedBuilder } from "discord.js";
import { getDiscordClient } from "#server/discord.js";
import type { StoredGuildMessage } from "#server/types/messageData.js";
import { Logger } from "#server/utils/logger.js";

const logger = new Logger("discord.notifications.sendFilterNotification");

export type FilterNotificationEntry = {
    label: string;
    details: string;
};

function getAuthorLabel(stored: StoredGuildMessage): string {
    return stored.author.displayName ?? stored.author.globalName ?? stored.author.username;
}

function getMessagePreview(stored: StoredGuildMessage): string {
    const preview = stored.cleanContent.trim() || stored.content.trim();
    if (!preview) {
        return "(no text content)";
    }
    return preview.length > 500 ? `${preview.slice(0, 497)}...` : preview;
}

export function buildFilterNotificationEmbed(
    stored: StoredGuildMessage,
    entries: FilterNotificationEntry[],
): EmbedBuilder {
    const messageUrl = `https://discord.com/channels/${stored.guildId}/${stored.channelId}/${stored.messageId}`;
    const authorLabel = getAuthorLabel(stored);

    const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("Message Filter Triggered")
        .setURL(messageUrl)
        .setAuthor({
            name: authorLabel,
            iconURL: stored.author.avatarURL,
            url: `https://discord.com/users/${stored.author.userId}`,
        })
        .addFields(
            { name: "User", value: `<@${stored.author.userId}>`, inline: true },
            { name: "Channel", value: `<#${stored.channelId}>`, inline: true },
            { name: "Message", value: `[Jump to message](${messageUrl})`, inline: true },
            { name: "Preview", value: getMessagePreview(stored) },
        )
        .setTimestamp(new Date(stored.createdAt))
        .setFooter({ text: `Message ID: ${stored.messageId}` });

    for (const entry of entries) {
        embed.addFields({
            name: entry.label,
            value: entry.details.slice(0, 1024),
            inline: false,
        });
    }

    return embed;
}

export async function sendCombinedFilterNotification(
    notificationChannelId: string,
    stored: StoredGuildMessage,
    entries: FilterNotificationEntry[],
): Promise<void> {
    if (entries.length === 0) {
        return;
    }

    const client = getDiscordClient();
    if (!client?.isReady()) {
        logger.warn("Cannot send filter notification: Discord client is not ready");
        return;
    }

    try {
        const channel = await client.channels.fetch(notificationChannelId);
        if (!channel?.isTextBased() || channel.isDMBased()) {
            logger.warn(
                `Cannot send filter notification: channel ${notificationChannelId} is not a guild text channel`,
            );
            return;
        }

        const embed = buildFilterNotificationEmbed(stored, entries);
        await channel.send({ embeds: [embed] });
    } catch (error) {
        logger.error(`Failed to send filter notification: ${String(error)}`);
    }
}
