import { getDiscordClient} from "#server/discord.js";
import { PermissionsBitField } from "discord.js";

export async function kickGuildMember(
    guildId: string = process.env.DISCORD_GUILD_ID?.trim() ?? "",
    userId: string,
    reason: string,
): Promise<void> {
    const client = getDiscordClient();
    if (!client) {
        throw new Error("Discord Botが接続されていません。");
    }

    const guild = await client.guilds.fetch(guildId);

    const me = await guild.members.fetchMe();

    if (!me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        throw new Error("Botにメンバーをキックする権限がありません。");
    }

    const member = await guild.members.fetch(userId);

    if (!member.kickable) {
        throw new Error(
            "このユーザーはキックできません。Botのロール階層を確認してください。",
        );
    }

    await guild.members.kick(member, reason);
}