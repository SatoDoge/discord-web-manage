import { PermissionsBitField } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import {
  toGuildRoleSummary,
  type GuildRoleSummary,
} from '#server/discord/getRoleList.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/createRole');

export type CreateGuildRoleInput = {
  name: string;
  color?: number;
  hoist?: boolean;
  mentionable?: boolean;
  permissions?: string[];
  reason?: string;
};

export type CreateGuildRoleError =
  | 'bot_not_connected'
  | 'guild_not_configured'
  | 'guild_not_found'
  | 'missing_permission'
  | 'invalid_permission'
  | 'create_failed';

export type CreateGuildRoleResult =
  | { ok: true; data: GuildRoleSummary }
  | { ok: false; error: CreateGuildRoleError };

const VALID_PERMISSION_FLAGS = new Set(Object.keys(PermissionsBitField.Flags));

export function parsePermissionFlags(
  flags: string[],
): { ok: true; bitfield: PermissionsBitField } | { ok: false } {
  const bitfield = new PermissionsBitField();
  for (const flag of flags) {
    if (!VALID_PERMISSION_FLAGS.has(flag)) {
      return { ok: false };
    }
    bitfield.add(flag as keyof typeof PermissionsBitField.Flags);
  }
  return { ok: true, bitfield };
}

/** Create a guild role. */
export async function createGuildRole(
  input: CreateGuildRoleInput,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<CreateGuildRoleResult> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  if (!guildId) {
    logger.error('DISCORD_GUILD_ID is not set');
    return { ok: false, error: 'guild_not_configured' };
  }

  let permissions: PermissionsBitField | undefined;
  if (input.permissions !== undefined) {
    const parsed = parsePermissionFlags(input.permissions);
    if (!parsed.ok) {
      return { ok: false, error: 'invalid_permission' };
    }
    permissions = parsed.bitfield;
  }

  try {
    const guild = await client.guilds.fetch(guildId);
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return { ok: false, error: 'missing_permission' };
    }

    const role = await guild.roles.create({
      name: input.name.trim(),
      color: input.color,
      hoist: input.hoist,
      mentionable: input.mentionable,
      permissions,
      reason: input.reason?.trim() || undefined,
    });

    return { ok: true, data: toGuildRoleSummary(role) };
  } catch (error) {
    logger.error(`Failed to create role "${input.name}": ${String(error)}`);
    return { ok: false, error: 'create_failed' };
  }
}
