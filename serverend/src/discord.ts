import { Client, Events, GatewayIntentBits } from "discord.js";
import { Logger } from "#server/utils/logger.js";
import { onGuildMemberUpdate } from "#server/discord/event/onGuildMemberUpdate.js";
import { onGuildMemberAdd } from "#server/discord/event/onGuildMemberAdd.js";
import { onGuildMemberRemove } from "#server/discord/event/onGuildMemberRemove.js";
import { onPresenceUpdate } from "#server/discord/event/onPresenceUpdate.js";
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
            GatewayIntentBits.GuildMessages,    // メッセージを取得するために使用
            GatewayIntentBits.GuildMembers,     // メンバーを取得するために使用
            GatewayIntentBits.GuildPresences,   // プレゼンス（ステータス）を取得するために使用
            GatewayIntentBits.MessageContent,   // メッセージの内容を取得するために使用
        ],
    });

    client.once(Events.ClientReady, (readyClient) => {
        logger.info(`Logged in as ${readyClient.user.tag}`);

        /* イベント登録 */
        onGuildMemberUpdate();
        onGuildMemberAdd();
        onGuildMemberRemove();
        onPresenceUpdate();
    });

    client.login(token);
}
export default client;

export function getDiscordClient() {
    return client;
}
