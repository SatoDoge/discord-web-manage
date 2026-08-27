/** Discord snowflake ID. */
export type Snowflake = string;

/**
 * Author types for guild message search.
 * @see https://docs.discord.com/developers/resources/message#search-guild-messages-author-types
 */
export const SEARCH_AUTHOR_TYPES = ['user', 'bot', 'webhook'] as const;
export type SearchAuthorType = (typeof SEARCH_AUTHOR_TYPES)[number];

/**
 * Content attachment/embed filters for guild message search.
 * @see https://docs.discord.com/developers/resources/message#search-guild-messages-search-has-types
 */
export const SEARCH_HAS_TYPES = [
  'image',
  'sound',
  'video',
  'file',
  'sticker',
  'embed',
  'link',
  'poll',
  'snapshot',
] as const;
export type SearchHasType = (typeof SEARCH_HAS_TYPES)[number];

/**
 * Embed type filters for guild message search.
 * @see https://docs.discord.com/developers/resources/message#search-guild-messages-search-embed-types
 */
export const SEARCH_EMBED_TYPES = [
  'image',
  'video',
  'gif',
  'sound',
  'article',
] as const;
export type SearchEmbedType = (typeof SEARCH_EMBED_TYPES)[number];

/**
 * Sort algorithm for guild message search.
 * @see https://docs.discord.com/developers/resources/message#search-guild-messages-search-sort-modes
 */
export const SEARCH_SORT_BY = ['timestamp', 'relevance'] as const;
export type SearchSortBy = (typeof SEARCH_SORT_BY)[number];

/** Sort direction (ignored when sort_by is relevance). */
export const SEARCH_SORT_ORDER = ['asc', 'desc'] as const;
export type SearchSortOrder = (typeof SEARCH_SORT_ORDER)[number];

/** Prefix with `-` to exclude matches (supported by author_type and has). */
export type Negatable<T extends string> = T | `-${T}`;

/**
 * Query string parameters for
 * `GET /guilds/{guild.id}/messages/search`
 * @see https://docs.discord.com/developers/resources/message#search-guild-messages
 */
export type searchMessageQuery = {
  /** Max number of messages to return (1–25, default 25). */
  limit?: number;
  /** Number to offset the returned messages by (max 9975). */
  offset?: number;
  /** Get messages before this message ID. */
  max_id?: Snowflake;
  /** Get messages after this message ID. */
  min_id?: Snowflake;
  /** Max words to skip between matching tokens in content (max 100, default 2). */
  slop?: number;
  /** Filter messages by content (max 1024 characters). */
  content?: string;
  /** Filter messages by these channels (max 500). */
  channel_id?: Snowflake[];
  /** Filter messages by author type. Prefix with `-` to negate. */
  author_type?: Negatable<SearchAuthorType>[];
  /** Filter messages by these authors (max 100). */
  author_id?: Snowflake[];
  /** Filter messages that mention these users (max 100). */
  mentions?: Snowflake[];
  /** Filter messages that mention these roles (max 100). */
  mentions_role_id?: Snowflake[];
  /** Filter messages that do or do not mention @everyone. */
  mention_everyone?: boolean;
  /** Filter messages that reply to these users (max 100). */
  replied_to_user_id?: Snowflake[];
  /** Filter messages that reply to these messages (max 100). */
  replied_to_message_id?: Snowflake[];
  /** Filter messages by whether they are pinned. */
  pinned?: boolean;
  /** Filter messages by attachment/embed/content presence. Prefix with `-` to negate. */
  has?: Negatable<SearchHasType>[];
  /** Filter messages by embed type. */
  embed_type?: SearchEmbedType[];
  /** Filter by embed provider (case-sensitive, e.g. `Tenor`; max 256 chars each, max 100). */
  embed_provider?: string[];
  /** Filter by link hostname (e.g. `discordapp.com`; max 256 chars each, max 100). */
  link_hostname?: string[];
  /** Filter by attachment filename (max 1024 chars each, max 100). */
  attachment_filename?: string[];
  /** Filter by attachment extension (e.g. `txt`; max 256 chars each, max 100). */
  attachment_extension?: string[];
  /** Sorting algorithm (default `timestamp`). */
  sort_by?: SearchSortBy;
  /** Sort direction (default `desc`; ignored when sort_by is `relevance`). */
  sort_order?: SearchSortOrder;
  /** Include results from age-restricted channels (default false). */
  include_nsfw?: boolean;
};
