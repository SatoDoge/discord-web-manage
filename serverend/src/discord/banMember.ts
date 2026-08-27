import { getDiscordClient} from "#server/discord.js";
import { PermissionsBitField } from "discord.js";

export async function banGuildMember(
    guildId: string = process.env.DISCORD_GUILD_ID?.trim() ?? "",
    userId: string,
    reason: string,
    deleteMessageSeconds = 0,
): Promise<void> {
    const client = getDiscordClient();
    if (!client) {
        throw new Error("Discord Botが接続されていません。");
    }

    const guild = await client.guilds.fetch(guildId);

    // Bot自身のギルド内権限を確認
    const me = await guild.members.fetchMe();

    if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        throw new Error("BotにメンバーBAN権限がありません。");
    }

    // 対象メンバーを取得
    const member = await guild.members.fetch(userId);

    // サーバー所有者、Bot以上のロールを持つメンバー等はBANできない
    if (!member.bannable) {
        throw new Error(
            "このユーザーはBANできません。Botのロール階層を確認してください。",
        );
    }

    await guild.members.ban(member, {
        reason,
        deleteMessageSeconds,
    });
}