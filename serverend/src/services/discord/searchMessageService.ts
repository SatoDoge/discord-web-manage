import {
  searchMessages,
  type SearchMessageError,
  type SearchMessageResponse,
  type SearchMessageResult,
} from '#server/discord/searchMessage.js';
import {
  SEARCH_AUTHOR_TYPES,
  SEARCH_EMBED_TYPES,
  SEARCH_HAS_TYPES,
  SEARCH_SORT_BY,
  SEARCH_SORT_ORDER,
  type Negatable,
  type SearchAuthorType,
  type SearchEmbedType,
  type SearchHasType,
  type SearchSortBy,
  type SearchSortOrder,
  type searchMessageQuery,
} from '#server/types/searchMessageQuery.js';

export type {
  SearchMessageError,
  SearchMessageResponse,
  SearchMessageResult,
  searchMessageQuery,
};

export type SearchMessagesServiceResult =
  | { ok: true; data: SearchMessageResponse }
  | {
      ok: false;
      status: number;
      error: SearchMessageError | 'invalid_query';
      retryAfter?: number;
    };

const SNOWFLAKE_RE = /^\d{17,20}$/;

function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && SNOWFLAKE_RE.test(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isSnowflakeArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isSnowflake);
}

function isNegatableUnion<T extends string>(
  value: string,
  allowed: readonly T[],
): value is Negatable<T> {
  const bare = value.startsWith('-') ? value.slice(1) : value;
  return (allowed as readonly string[]).includes(bare);
}

function isNegatableArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is Negatable<T>[] {
  return isStringArray(value) && value.every((entry) => isNegatableUnion(entry, allowed));
}

function isAllowedArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) => typeof entry === 'string' && (allowed as readonly string[]).includes(entry),
    )
  );
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate and normalize an unknown body into searchMessageQuery.
 * Returns null when the payload is invalid.
 */
export function parseSearchMessageQuery(
  body: unknown,
): searchMessageQuery | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const input = body as Record<string, unknown>;
  const query: searchMessageQuery = {};

  if (input.limit !== undefined) {
    if (!isFiniteNumber(input.limit) || input.limit < 1 || input.limit > 25) {
      return null;
    }
    query.limit = Math.trunc(input.limit);
  }

  if (input.offset !== undefined) {
    if (!isFiniteNumber(input.offset) || input.offset < 0 || input.offset > 9975) {
      return null;
    }
    query.offset = Math.trunc(input.offset);
  }

  if (input.max_id !== undefined) {
    if (!isSnowflake(input.max_id)) {
      return null;
    }
    query.max_id = input.max_id;
  }

  if (input.min_id !== undefined) {
    if (!isSnowflake(input.min_id)) {
      return null;
    }
    query.min_id = input.min_id;
  }

  if (input.slop !== undefined) {
    if (!isFiniteNumber(input.slop) || input.slop < 0 || input.slop > 100) {
      return null;
    }
    query.slop = Math.trunc(input.slop);
  }

  if (input.content !== undefined) {
    if (typeof input.content !== 'string' || input.content.length > 1024) {
      return null;
    }
    query.content = input.content;
  }

  if (input.channel_id !== undefined) {
    if (!isSnowflakeArray(input.channel_id) || input.channel_id.length > 500) {
      return null;
    }
    query.channel_id = input.channel_id;
  }

  if (input.author_type !== undefined) {
    if (!isNegatableArray(input.author_type, SEARCH_AUTHOR_TYPES)) {
      return null;
    }
    query.author_type = input.author_type as Negatable<SearchAuthorType>[];
  }

  if (input.author_id !== undefined) {
    if (!isSnowflakeArray(input.author_id) || input.author_id.length > 100) {
      return null;
    }
    query.author_id = input.author_id;
  }

  if (input.mentions !== undefined) {
    if (!isSnowflakeArray(input.mentions) || input.mentions.length > 100) {
      return null;
    }
    query.mentions = input.mentions;
  }

  if (input.mentions_role_id !== undefined) {
    if (
      !isSnowflakeArray(input.mentions_role_id) ||
      input.mentions_role_id.length > 100
    ) {
      return null;
    }
    query.mentions_role_id = input.mentions_role_id;
  }

  if (input.mention_everyone !== undefined) {
    if (!isBoolean(input.mention_everyone)) {
      return null;
    }
    query.mention_everyone = input.mention_everyone;
  }

  if (input.replied_to_user_id !== undefined) {
    if (
      !isSnowflakeArray(input.replied_to_user_id) ||
      input.replied_to_user_id.length > 100
    ) {
      return null;
    }
    query.replied_to_user_id = input.replied_to_user_id;
  }

  if (input.replied_to_message_id !== undefined) {
    if (
      !isSnowflakeArray(input.replied_to_message_id) ||
      input.replied_to_message_id.length > 100
    ) {
      return null;
    }
    query.replied_to_message_id = input.replied_to_message_id;
  }

  if (input.pinned !== undefined) {
    if (!isBoolean(input.pinned)) {
      return null;
    }
    query.pinned = input.pinned;
  }

  if (input.has !== undefined) {
    if (!isNegatableArray(input.has, SEARCH_HAS_TYPES)) {
      return null;
    }
    query.has = input.has as Negatable<SearchHasType>[];
  }

  if (input.embed_type !== undefined) {
    if (!isAllowedArray(input.embed_type, SEARCH_EMBED_TYPES)) {
      return null;
    }
    query.embed_type = input.embed_type as SearchEmbedType[];
  }

  if (input.embed_provider !== undefined) {
    if (
      !isStringArray(input.embed_provider) ||
      input.embed_provider.length > 100 ||
      input.embed_provider.some((entry) => entry.length > 256)
    ) {
      return null;
    }
    query.embed_provider = input.embed_provider;
  }

  if (input.link_hostname !== undefined) {
    if (
      !isStringArray(input.link_hostname) ||
      input.link_hostname.length > 100 ||
      input.link_hostname.some((entry) => entry.length > 256)
    ) {
      return null;
    }
    query.link_hostname = input.link_hostname;
  }

  if (input.attachment_filename !== undefined) {
    if (
      !isStringArray(input.attachment_filename) ||
      input.attachment_filename.length > 100 ||
      input.attachment_filename.some((entry) => entry.length > 1024)
    ) {
      return null;
    }
    query.attachment_filename = input.attachment_filename;
  }

  if (input.attachment_extension !== undefined) {
    if (
      !isStringArray(input.attachment_extension) ||
      input.attachment_extension.length > 100 ||
      input.attachment_extension.some((entry) => entry.length > 256)
    ) {
      return null;
    }
    query.attachment_extension = input.attachment_extension;
  }

  if (input.sort_by !== undefined) {
    if (
      typeof input.sort_by !== 'string' ||
      !(SEARCH_SORT_BY as readonly string[]).includes(input.sort_by)
    ) {
      return null;
    }
    query.sort_by = input.sort_by as SearchSortBy;
  }

  if (input.sort_order !== undefined) {
    if (
      typeof input.sort_order !== 'string' ||
      !(SEARCH_SORT_ORDER as readonly string[]).includes(input.sort_order)
    ) {
      return null;
    }
    query.sort_order = input.sort_order as SearchSortOrder;
  }

  if (input.include_nsfw !== undefined) {
    if (!isBoolean(input.include_nsfw)) {
      return null;
    }
    query.include_nsfw = input.include_nsfw;
  }

  return query;
}

function errorStatus(error: SearchMessageError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'index_not_ready':
      return 202;
    default:
      return 400;
  }
}

/** Search guild messages with a validated query. */
export async function searchGuildMessages(
  body: unknown,
): Promise<SearchMessagesServiceResult> {
  const query = parseSearchMessageQuery(body);
  if (!query) {
    return { ok: false, status: 400, error: 'invalid_query' };
  }

  const result = await searchMessages(query);
  if (!result.ok) {
    return {
      ok: false,
      status: errorStatus(result.error),
      error: result.error,
      retryAfter: result.retryAfter,
    };
  }

  return { ok: true, data: result.data };
}
