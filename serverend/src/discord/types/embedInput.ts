/**
 * Generic embed payload accepted from external callers.
 * Supports both Discord REST API (snake_case) and common JS (camelCase) field names.
 *
 * @see https://discord.com/developers/docs/resources/message#embed-object
 */
export type DiscordEmbedAuthorInput = {
  name: string;
  url?: string;
  icon_url?: string;
  iconURL?: string;
};

export type DiscordEmbedFooterInput = {
  text: string;
  icon_url?: string;
  iconURL?: string;
};

export type DiscordEmbedImageInput = {
  url: string;
};

export type DiscordEmbedFieldInput = {
  name: string;
  value: string;
  inline?: boolean;
};

export type DiscordEmbedInput = {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string | number | Date;
  color?: number;
  footer?: DiscordEmbedFooterInput;
  image?: DiscordEmbedImageInput;
  thumbnail?: DiscordEmbedImageInput;
  author?: DiscordEmbedAuthorInput;
  fields?: DiscordEmbedFieldInput[];
};
