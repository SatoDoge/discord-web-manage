import {
  getGuildChannelDetail,
  type GetChannelDetailError,
  type GuildChannelDetail,
} from '#server/discord/getChannelDetail.js';

export type { GetChannelDetailError, GuildChannelDetail };

export type FetchChannelDetailResult =
  | { ok: true; data: GuildChannelDetail }
  | { ok: false; status: number; error: GetChannelDetailError };

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

/** Fetch detailed guild channel info including category and permission overwrites. */
export async function fetchChannelDetail(
  channelId: string,
): Promise<FetchChannelDetailResult> {
  const result = await getGuildChannelDetail(channelId);
  if (!result.ok) {
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }
  return { ok: true, data: result.data };
}
