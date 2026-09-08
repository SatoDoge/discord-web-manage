import { PermissionsBitField } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import {
  toGuildRoleSummary,
  type GuildRoleSummary,
} from '#server/discord/getRoleList.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/deleteRole');

export type DeleteGuildRoleError =
  | 'bot_not_connected'
  | 'guild_not_configured'
  | 'guild_not_found'
  | 'role_not_found'
  | 'missing_permission'
  | 'role_not_editable'
  | 'role_not_deletable'
  | 'delete_failed';

export type DeleteGuildRoleResult =
  | { ok: true; data: GuildRoleSummary }
  | { ok: false; error: DeleteGuildRoleError };

/** Delete a guild role (@everyone and managed roles cannot be deleted). */
export async function deleteGuildRole(
  roleId: string,
  reason?: string,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<DeleteGuildRoleResult> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  if (!guildId) {
    logger.error('DISCORD_GUILD_ID is not set');
    return { ok: false, error: 'guild_not_configured' };
  }

  try {
    const guild = await client.guilds.fetch(guildId);
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return { ok: false, error: 'missing_permission' };
    }

    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      return { ok: false, error: 'role_not_found' };
    }
    if (role.id === guild.id || role.managed) {
      return { ok: false, error: 'role_not_deletable' };
    }
    if (!role.editable) {
      return { ok: false, error: 'role_not_editable' };
    }

    const snapshot = toGuildRoleSummary(role);
    await role.delete(reason?.trim() || undefined);
    return { ok: true, data: snapshot };
  } catch (error) {
    logger.error(`Failed to delete role ${roleId}: ${String(error)}`);
    return { ok: false, error: 'delete_failed' };
  }
}
