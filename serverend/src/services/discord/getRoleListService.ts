import {
  getGuildRoleDetail,
  getGuildRoleList,
  type GetRoleDetailError,
  type GetRoleListError,
  type GuildRoleSummary,
} from '#server/discord/getRoleList.js';

export type { GetRoleDetailError, GetRoleListError, GuildRoleSummary };

export type FetchRoleListResult =
  | { ok: true; data: GuildRoleSummary[] }
  | { ok: false; status: number; error: GetRoleListError };

export type FetchRoleDetailResult =
  | { ok: true; data: GuildRoleSummary }
  | { ok: false; status: number; error: GetRoleDetailError };

function listErrorStatus(error: GetRoleListError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    default:
      return 404;
  }
}

function detailErrorStatus(error: GetRoleDetailError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'role_not_found':
    case 'guild_not_found':
      return 404;
    default:
      return 400;
  }
}

/** Fetch guild roles for management UI and permission overwrite editing. */
export async function fetchRoleList(): Promise<FetchRoleListResult> {
  const result = await getGuildRoleList();
  if (!result.ok) {
    return { ok: false, status: listErrorStatus(result.error), error: result.error };
  }
  return { ok: true, data: result.data };
}

/** Fetch a single guild role by ID. */
export async function fetchRoleDetail(roleId: string): Promise<FetchRoleDetailResult> {
  const result = await getGuildRoleDetail(roleId);
  if (!result.ok) {
    return { ok: false, status: detailErrorStatus(result.error), error: result.error };
  }
  return { ok: true, data: result.data };
}
