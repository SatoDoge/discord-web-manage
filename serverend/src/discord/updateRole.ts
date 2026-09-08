import { PermissionsBitField, type RoleEditOptions } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import { parsePermissionFlags } from '#server/discord/createRole.js';
import {
  toGuildRoleSummary,
  type GuildRoleSummary,
} from '#server/discord/getRoleList.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/updateRole');

export type UpdateGuildRoleInput = {
  name?: string;
  color?: number | null;
  hoist?: boolean;
  mentionable?: boolean;
  permissions?: string[];
  position?: number;
  reason?: string;
};

export type UpdateGuildRoleError =
  | 'bot_not_connected'
  | 'guild_not_configured'
  | 'guild_not_found'
  | 'role_not_found'
  | 'missing_permission'
  | 'role_not_editable'
  | 'invalid_permission'
  | 'name_not_allowed'
  | 'update_failed';

export type UpdateGuildRoleResult =
  | { ok: true; data: GuildRoleSummary }
  | { ok: false; error: UpdateGuildRoleError };

/** Update guild role properties (name, color, hoist, mentionable, permissions, position). */
export async function updateGuildRole(
  roleId: string,
  input: UpdateGuildRoleInput,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<UpdateGuildRoleResult> {
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
    if (!role.editable) {
      return { ok: false, error: 'role_not_editable' };
    }

    const isEveryone = role.id === guild.id;
    if (isEveryone && input.name !== undefined) {
      return { ok: false, error: 'name_not_allowed' };
    }

    const editOptions: RoleEditOptions = {};

    if (input.name !== undefined) {
      editOptions.name = input.name.trim();
    }
    if (input.color !== undefined) {
      editOptions.color = input.color === null ? 0 : input.color;
    }
    if (input.hoist !== undefined) {
      editOptions.hoist = input.hoist;
    }
    if (input.mentionable !== undefined) {
      editOptions.mentionable = input.mentionable;
    }
    if (input.permissions !== undefined) {
      const parsed = parsePermissionFlags(input.permissions);
      if (!parsed.ok) {
        return { ok: false, error: 'invalid_permission' };
      }
      editOptions.permissions = parsed.bitfield;
    }
    if (input.position !== undefined) {
      editOptions.position = input.position;
    }

    if (Object.keys(editOptions).length === 0) {
      return { ok: true, data: toGuildRoleSummary(role) };
    }

    const updated = await role.edit({
      ...editOptions,
      reason: input.reason?.trim() || undefined,
    });

    return { ok: true, data: toGuildRoleSummary(updated) };
  } catch (error) {
    logger.error(`Failed to update role ${roleId}: ${String(error)}`);
    return { ok: false, error: 'update_failed' };
  }
}
