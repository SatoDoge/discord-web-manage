import {
  getVoiceChannelOccupancy,
  type GetVoiceOccupancyError,
  type VoiceChannelOccupancy,
} from '#server/discord/getVoiceOccupancy.js';

export type { GetVoiceOccupancyError, VoiceChannelOccupancy };

export type FetchVoiceOccupancyResult =
  | { ok: true; data: VoiceChannelOccupancy[] }
  | { ok: false; status: number; error: GetVoiceOccupancyError };

function errorStatus(error: GetVoiceOccupancyError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    default:
      return 404;
  }
}

/** Fetch voice/stage channels with connected members. */
export async function fetchVoiceOccupancy(): Promise<FetchVoiceOccupancyResult> {
  const result = await getVoiceChannelOccupancy();
  if (!result.ok) {
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }
  return { ok: true, data: result.data };
}
