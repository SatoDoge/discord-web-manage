import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/getRoleList');

export type GuildRoleSummary = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  hoist: boolean;
  mentionable: boolean;
};

export type GetRoleListError = 'bot_not_connected' | 'guild_not_configured' | 'guild_not_found';

export type GetRoleListResult =
  | { ok: true; data: GuildRoleSummary[] }
  | { ok: false; error: GetRoleListError };

/** Fetch guild roles for channel permission editing. */
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
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
        managed: role.managed,
        hoist: role.hoist,
        mentionable: role.mentionable,
      }))
      .sort((a, b) => b.position - a.position);

    return { ok: true, data };
  } catch (error) {
    logger.error(`Failed to fetch guild roles: ${String(error)}`);
    return { ok: false, error: 'guild_not_found' };
  }
}
