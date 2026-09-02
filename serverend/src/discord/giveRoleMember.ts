import { getDiscordClient } from "#server/discord.js";
import { PermissionsBitField } from "discord.js";

export async function giveRoleToMember(
    guildId: string = process.env.DISCORD_GUILD_ID?.trim() ?? "",
    userId: string,
    roleId: string,
    reason?: string,
): Promise<void> {
    const client = getDiscordClient();
    if (!client) {
        throw new Error("Discord Botが接続されていません。");
    }

    const guild = await client.guilds.fetch(guildId);
    const me = await guild.members.fetchMe();

    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        throw new Error("Botにロール管理権限がありません。");
    }

    const member = await guild.members.fetch(userId);
    const role = await guild.roles.fetch(roleId);

    if (!role) {
        throw new Error("指定されたロールが見つかりません。");
    }

    if (!role.editable) {
        throw new Error(
            "このロールは付与できません。Botのロール階層を確認してください。",
        );
    }

    if (member.roles.cache.has(roleId)) {
        return;
    }

    const auditReason = reason?.trim();
    await member.roles.add(role, auditReason || undefined);
}
