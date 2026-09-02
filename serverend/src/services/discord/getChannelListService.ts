import {
  getGuildChannelList,
  type GetChannelListError,
  type GuildChannelSummary,
} from '#server/discord/getChannelList.js';

export type { GetChannelListError, GuildChannelSummary };

export type FetchChannelListResult =
  | { ok: true; data: GuildChannelSummary[] }
  | { ok: false; status: number; error: GetChannelListError };

function errorStatus(error: GetChannelListError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    default:
      return 404;
  }
}

/** Return searchable text channels in the configured guild. */
export async function fetchChannelList(): Promise<FetchChannelListResult> {
  const result = await getGuildChannelList();
  if (!result.ok) {
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  return { ok: true, data: result.data };
}
