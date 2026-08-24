import { Client, Events, GatewayIntentBits } from "discord.js";
import { Logger } from "#server/utils/logger.js";

const logger = new Logger("discord");
let client: Client | null = null;

export function createDiscordClient() {
    const token = process.env.DISCORD_TOKEN;

    if (!token) {
        logger.error("DISCORD_TOKEN is not set");
    }

    client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ],
    });

    client.once(Events.ClientReady, (readyClient) => {
        logger.info(`Logged in as ${readyClient.user.tag}`);
    });

    client.login(token);
}
export default client;

export function getDiscordClient() {
    return client;
}
