import { PermissionsBitField, type Role } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/getRoleList');

export type GuildRoleSummary = {
  id: string;
  name: string;
  color: number;
  /** Hex color string without leading #, or null when color is 0 (default). */
  colorHex: string | null;
  position: number;
  managed: boolean;
  hoist: boolean;
  mentionable: boolean;
  /** Whether this is the @everyone role (id === guildId). */
  isEveryone: boolean;
  /** Whether the bot can edit/delete this role (hierarchy + managed). */
  editable: boolean;
  permissions: string[];
  permissionsBitfield: string;
};

export type GetRoleListError = 'bot_not_connected' | 'guild_not_configured' | 'guild_not_found';

export type GetRoleListResult =
  | { ok: true; data: GuildRoleSummary[] }
  | { ok: false; error: GetRoleListError };

export type GetRoleDetailError =
  | GetRoleListError
  | 'role_not_found';

export type GetRoleDetailResult =
  | { ok: true; data: GuildRoleSummary }
  | { ok: false; error: GetRoleDetailError };

function toColorHex(color: number): string | null {
  if (!color) {
    return null;
  }
  return color.toString(16).padStart(6, '0');
}

export function toGuildRoleSummary(role: Role): GuildRoleSummary {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    colorHex: toColorHex(role.color),
    position: role.position,
    managed: role.managed,
    hoist: role.hoist,
    mentionable: role.mentionable,
    isEveryone: role.id === role.guild.id,
    editable: role.editable,
    permissions: new PermissionsBitField(role.permissions.bitfield).toArray(),
    permissionsBitfield: role.permissions.bitfield.toString(),
  };
}

/** Fetch guild roles for management UI and channel permission editing. */
export async function getGuildRoleList(
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<GetRoleListResult> {
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
    const roles = await guild.roles.fetch();
    const data = [...roles.values()]
      .map((role) => toGuildRoleSummary(role))
      .sort((a, b) => b.position - a.position);

    return { ok: true, data };
  } catch (error) {
    logger.error(`Failed to fetch guild roles: ${String(error)}`);
    return { ok: false, error: 'guild_not_found' };
  }
}

/** Fetch a single guild role by ID. */
export async function getGuildRoleDetail(
  roleId: string,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<GetRoleDetailResult> {
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
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      return { ok: false, error: 'role_not_found' };
    }
    return { ok: true, data: toGuildRoleSummary(role) };
  } catch (error) {
    logger.error(`Failed to fetch role ${roleId}: ${String(error)}`);
    return { ok: false, error: 'guild_not_found' };
  }
}
