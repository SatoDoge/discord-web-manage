import {
  getGuildChannelDetail,
  type GetChannelDetailError,
  type GuildChannelDetail,
} from '#server/discord/getChannelDetail.js';

export type { GetChannelDetailError, GuildChannelDetail };

export type FetchChannelDetailResult =
  | { ok: true; data: GuildChannelDetail }
  | { ok: false; status: number; error: GetChannelDetailError };

const CACHE_TTL_MS = 1000;

const cacheByChannelId = new Map<
  string,
  { expiresAt: number; result: FetchChannelDetailResult }
>();
const inflightByChannelId = new Map<string, Promise<FetchChannelDetailResult>>();

function errorStatus(error: GetChannelDetailError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'channel_not_found':
    case 'guild_not_found':
      return 404;
    case 'channel_not_guild':
      return 400;
    default:
      return 400;
  }
}

async function loadChannelDetail(channelId: string): Promise<FetchChannelDetailResult> {
  const result = await getGuildChannelDetail(channelId);
  if (!result.ok) {
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }
  return { ok: true, data: result.data };
}

/**
 * Fetch detailed guild channel info including category and permission overwrites.
 * Short in-memory cache (1s) plus in-flight coalescing per channel ID.
 */
export async function fetchChannelDetail(
  channelId: string,
): Promise<FetchChannelDetailResult> {
  const now = Date.now();
  const cached = cacheByChannelId.get(channelId);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const inflight = inflightByChannelId.get(channelId);
  if (inflight) {
    return inflight;
  }

  const pending = loadChannelDetail(channelId)
    .then((result) => {
      cacheByChannelId.set(channelId, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        result,
      });
      return result;
    })
    .finally(() => {
      inflightByChannelId.delete(channelId);
    });

  inflightByChannelId.set(channelId, pending);
  return pending;
}

/** Clear short-lived channel detail cache after channel mutations. */
export function invalidateChannelDetailCache(channelId?: string): void {
  if (channelId) {
    cacheByChannelId.delete(channelId);
    return;
  }
  cacheByChannelId.clear();
}
