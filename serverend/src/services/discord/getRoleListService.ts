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

const CACHE_TTL_MS = 1000;

let listCache: { expiresAt: number; result: FetchRoleListResult } | null = null;
let listInflight: Promise<FetchRoleListResult> | null = null;

const detailCache = new Map<
  string,
  { expiresAt: number; result: FetchRoleDetailResult }
>();
const detailInflight = new Map<string, Promise<FetchRoleDetailResult>>();

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

async function loadRoleList(): Promise<FetchRoleListResult> {
  const result = await getGuildRoleList();
  if (!result.ok) {
    return { ok: false, status: listErrorStatus(result.error), error: result.error };
  }
  return { ok: true, data: result.data };
}

async function loadRoleDetail(roleId: string): Promise<FetchRoleDetailResult> {
  const result = await getGuildRoleDetail(roleId);
  if (!result.ok) {
    return { ok: false, status: detailErrorStatus(result.error), error: result.error };
  }
  return { ok: true, data: result.data };
}

/**
 * Fetch guild roles for management UI and permission overwrite editing.
 * Short in-memory cache (1s) plus in-flight coalescing to absorb bursty UI navigations.
 */
export async function fetchRoleList(): Promise<FetchRoleListResult> {
  const now = Date.now();
  if (listCache && listCache.expiresAt > now) {
    return listCache.result;
  }

  if (listInflight) {
    return listInflight;
  }

  const pending = loadRoleList()
    .then((result) => {
      listCache = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        result,
      };
      return result;
    })
    .finally(() => {
      listInflight = null;
    });

  listInflight = pending;
  return pending;
}

/**
 * Fetch a single guild role by ID.
 * Short in-memory cache (1s) plus in-flight coalescing per role ID.
 */
export async function fetchRoleDetail(roleId: string): Promise<FetchRoleDetailResult> {
  const now = Date.now();
  const cached = detailCache.get(roleId);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const inflight = detailInflight.get(roleId);
  if (inflight) {
    return inflight;
  }

  const pending = loadRoleDetail(roleId)
    .then((result) => {
      detailCache.set(roleId, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        result,
      });
      return result;
    })
    .finally(() => {
      detailInflight.delete(roleId);
    });

  detailInflight.set(roleId, pending);
  return pending;
}

/** Clear short-lived role caches after role mutations. */
export function invalidateRoleListCache(): void {
  listCache = null;
  detailCache.clear();
}
