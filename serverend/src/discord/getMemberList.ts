import { getDiscordClient } from "#server/discord.js";
import { Logger } from "#server/utils/logger.js";

const logger = new Logger("discord.getMemberList");

export async function getMemberList() {
    const client = getDiscordClient();
    if (!client) {
        logger.error("Discord client not found");
        return [];
    }
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID ?? "");
    if (!guild) {
        logger.error("Guild not found");
        return [];
    }
    const members = await guild.members.fetch();
    return members
}