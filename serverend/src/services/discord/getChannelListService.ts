import {
  getGuildChannelList,
  type ChannelListScope,
  type GetChannelListError,
  type GuildChannelSummary,
} from '#server/discord/getChannelList.js';

export type { ChannelListScope, GetChannelListError, GuildChannelSummary };

export type FetchChannelListResult =
  | { ok: true; data: GuildChannelSummary[] }
  | { ok: false; status: number; error: GetChannelListError };

const CACHE_TTL_MS = 1000;

const cacheByScope = new Map<
  ChannelListScope,
  {
    expiresAt: number;
    result: FetchChannelListResult;
  }
>();
const inflightByScope = new Map<ChannelListScope, Promise<FetchChannelListResult>>();

function errorStatus(error: GetChannelListError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    default:
      return 404;
  }
}

async function loadChannelList(scope: ChannelListScope): Promise<FetchChannelListResult> {
  const result = await getGuildChannelList(undefined, scope);
  if (!result.ok) {
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  return { ok: true, data: result.data };
}

/**
 * Return guild channels.
 * - `text` (default): searchable text/forum/thread channels for filters and message tools
 * - `manage`: text/voice/category/forum channels for the management UI
 *
 * Short in-memory cache (1s) plus in-flight coalescing to absorb bursty UI navigations.
 */
export async function fetchChannelList(
  scope: ChannelListScope = 'text',
): Promise<FetchChannelListResult> {
  const now = Date.now();
  const cached = cacheByScope.get(scope);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const inflight = inflightByScope.get(scope);
  if (inflight) {
    return inflight;
  }

  const pending = loadChannelList(scope)
    .then((result) => {
      cacheByScope.set(scope, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        result,
      });
      return result;
    })
    .finally(() => {
      inflightByScope.delete(scope);
    });

  inflightByScope.set(scope, pending);
  return pending;
}

/** Clear the short-lived channel list cache after channel mutations. */
export function invalidateChannelListCache(): void {
  cacheByScope.clear();
}
