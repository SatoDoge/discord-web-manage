import {
  getGuildChannelList,
  type GetChannelListError,
  type GuildChannelSummary,
} from '#server/discord/getChannelList.js';

export type { GetChannelListError, GuildChannelSummary };

export type FetchChannelListResult =
  | { ok: true; data: GuildChannelSummary[] }
  | { ok: false; status: number; error: GetChannelListError };

const CACHE_TTL_MS = 1000;

let cache:
  | {
      expiresAt: number;
      result: FetchChannelListResult;
    }
  | null = null;
let inflight: Promise<FetchChannelListResult> | null = null;

function errorStatus(error: GetChannelListError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    default:
      return 404;
  }
}

async function loadChannelList(): Promise<FetchChannelListResult> {
  const result = await getGuildChannelList();
  if (!result.ok) {
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  return { ok: true, data: result.data };
}

/**
 * Return searchable text channels in the configured guild.
 * Short in-memory cache (1s) plus in-flight coalescing to absorb bursty UI navigations.
 */
export async function fetchChannelList(): Promise<FetchChannelListResult> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.result;
  }

  if (inflight) {
    return inflight;
  }

  inflight = loadChannelList()
    .then((result) => {
      cache = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        result,
      };
      return result;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
