import { getDiscordClient } from '#server/discord.js';
import { Events, type Message } from 'discord.js';
import { Logger } from '#server/utils/logger.js';
import { handleMessageFilter } from '#server/discord/handlers/messageFilter.js';

const logger = new Logger('discord.event.onMessageCreate');

export function onMessageCreate() {
    const client = getDiscordClient();
    if (!client) {
        logger.error('Discord client not found');
        return;
    }
    client.on(Events.MessageCreate, (message) => {
        void handleMessageCreate(message);
    });
}

export async function handleMessageCreate(message: Message) {
    // DM の場合は無視
    if (!message.inGuild()) {
        return;
    }

    // Botのメッセージは無視
    if (message.author.bot) return;

    // logger.info(`Message created: ${message}`);
    await handleMessageFilter(message);
}