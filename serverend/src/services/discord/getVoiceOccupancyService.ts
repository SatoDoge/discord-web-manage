import {
  getVoiceChannelOccupancy,
  type GetVoiceOccupancyError,
  type VoiceChannelOccupancy,
} from '#server/discord/getVoiceOccupancy.js';

export type { GetVoiceOccupancyError, VoiceChannelOccupancy };

export type FetchVoiceOccupancyResult =
  | { ok: true; data: VoiceChannelOccupancy[] }
  | { ok: false; status: number; error: GetVoiceOccupancyError };

const CACHE_TTL_MS = 1000;

let cache: { expiresAt: number; result: FetchVoiceOccupancyResult } | null = null;
let inflight: Promise<FetchVoiceOccupancyResult> | null = null;

function errorStatus(error: GetVoiceOccupancyError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    default:
      return 404;
  }
}

async function loadVoiceOccupancy(): Promise<FetchVoiceOccupancyResult> {
  const result = await getVoiceChannelOccupancy();
  if (!result.ok) {
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }
  return { ok: true, data: result.data };
}

/**
 * Fetch voice/stage channels with connected members.
 * Short in-memory cache (1s) plus in-flight coalescing to absorb concurrent polls.
 */
export async function fetchVoiceOccupancy(): Promise<FetchVoiceOccupancyResult> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.result;
  }

  if (inflight) {
    return inflight;
  }

  const pending = loadVoiceOccupancy()
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

  inflight = pending;
  return pending;
}

/** Clear the short-lived voice occupancy cache after voice mutations. */
export function invalidateVoiceOccupancyCache(): void {
  cache = null;
}
