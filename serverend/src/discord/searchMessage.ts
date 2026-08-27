import type { APIMessage } from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import type { searchMessageQuery } from '#server/types/searchMessageQuery.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/searchMessage');

export type SearchMessageError =
  | 'bot_not_connected'
  | 'guild_not_configured'
  | 'index_not_ready';

/**
 * Response body for `GET /guilds/{guild.id}/messages/search`.
 * @see https://docs.discord.com/developers/resources/message#search-guild-messages
 */
export type SearchMessageResponse = {
  doing_deep_historical_index: boolean;
  documents_indexed?: number;
  total_results: number;
  /** Nested arrays of matching messages (context windows are no longer returned). */
  messages: APIMessage[][];
  /** Threads that contain the returned messages. */
  threads?: unknown[];
  /** Thread member objects for returned threads the bot has joined. */
  members?: unknown[];
};

export type SearchMessageResult =
  | { ok: true; data: SearchMessageResponse }
  | { ok: false; error: SearchMessageError; retryAfter?: number };

function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean,
): void {
  params.append(key, String(value));
}

function appendArrayParam(
  params: URLSearchParams,
  key: string,
  values: readonly (string | number)[] | undefined,
): void {
  if (!values?.length) {
    return;
  }
  for (const value of values) {
    params.append(key, String(value));
  }
}

/** Build Discord search query string from typed options. */
export function buildSearchMessageParams(
  query: searchMessageQuery,
): URLSearchParams {
  const params = new URLSearchParams();

  if (query.limit !== undefined) {
    appendParam(params, 'limit', query.limit);
  }
  if (query.offset !== undefined) {
    appendParam(params, 'offset', query.offset);
  }
  if (query.max_id !== undefined) {
    appendParam(params, 'max_id', query.max_id);
  }
  if (query.min_id !== undefined) {
    appendParam(params, 'min_id', query.min_id);
  }
  if (query.slop !== undefined) {
    appendParam(params, 'slop', query.slop);
  }
  if (query.content !== undefined) {
    appendParam(params, 'content', query.content);
  }
  if (query.mention_everyone !== undefined) {
    appendParam(params, 'mention_everyone', query.mention_everyone);
  }
  if (query.pinned !== undefined) {
    appendParam(params, 'pinned', query.pinned);
  }
  if (query.sort_by !== undefined) {
    appendParam(params, 'sort_by', query.sort_by);
  }
  if (query.sort_order !== undefined) {
    appendParam(params, 'sort_order', query.sort_order);
  }
  if (query.include_nsfw !== undefined) {
    appendParam(params, 'include_nsfw', query.include_nsfw);
  }

  appendArrayParam(params, 'channel_id', query.channel_id);
  appendArrayParam(params, 'author_type', query.author_type);
  appendArrayParam(params, 'author_id', query.author_id);
  appendArrayParam(params, 'mentions', query.mentions);
  appendArrayParam(params, 'mentions_role_id', query.mentions_role_id);
  appendArrayParam(params, 'replied_to_user_id', query.replied_to_user_id);
  appendArrayParam(params, 'replied_to_message_id', query.replied_to_message_id);
  appendArrayParam(params, 'has', query.has);
  appendArrayParam(params, 'embed_type', query.embed_type);
  appendArrayParam(params, 'embed_provider', query.embed_provider);
  appendArrayParam(params, 'link_hostname', query.link_hostname);
  appendArrayParam(params, 'attachment_filename', query.attachment_filename);
  appendArrayParam(params, 'attachment_extension', query.attachment_extension);

  return params;
}

type IndexPendingBody = {
  message?: string;
  code?: number;
  documents_indexed?: number;
  retry_after?: number;
};

/**
 * Search guild messages via Discord REST.
 * @see https://docs.discord.com/developers/resources/message#search-guild-messages
 */
export async function searchMessages(
  query: searchMessageQuery,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<SearchMessageResult> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  if (!guildId) {
    logger.error('DISCORD_GUILD_ID is not set');
    return { ok: false, error: 'guild_not_configured' };
  }

  const params = buildSearchMessageParams(query);
  const path =
    `/guilds/${guildId}/messages/search?${params.toString()}` as `/${string}`;

  try {
    const result = (await client.rest.get(path)) as
      | SearchMessageResponse
      | IndexPendingBody;

    // 202-style body when the guild search index is not ready yet.
    if (
      result &&
      typeof result === 'object' &&
      'retry_after' in result &&
      !('messages' in result)
    ) {
      const pending = result as IndexPendingBody;
      logger.warn(
        `Search index not ready (code=${pending.code ?? 'unknown'}, retry_after=${pending.retry_after ?? 0})`,
      );
      return {
        ok: false,
        error: 'index_not_ready',
        retryAfter: pending.retry_after,
      };
    }

    return { ok: true, data: result as SearchMessageResponse };
  } catch (error) {
    logger.error(`Failed to search messages: ${String(error)}`);
    throw error;
  }
}
