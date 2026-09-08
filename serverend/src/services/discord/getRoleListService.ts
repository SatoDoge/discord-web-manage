import {
  getGuildRoleList,
  type GetRoleListError,
  type GuildRoleSummary,
} from '#server/discord/getRoleList.js';

export type { GetRoleListError, GuildRoleSummary };

export type FetchRoleListResult =
  | { ok: true; data: GuildRoleSummary[] }
  | { ok: false; status: number; error: GetRoleListError };

function errorStatus(error: GetRoleListError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    default:
      return 404;
  }
}

/** Fetch guild roles for permission overwrite editing. */
export async function fetchRoleList(): Promise<FetchRoleListResult> {
  const result = await getGuildRoleList();
  if (!result.ok) {
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }
  return { ok: true, data: result.data };
}
