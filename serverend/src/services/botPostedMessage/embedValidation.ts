import type { DiscordEmbedInput } from '#server/discord/types/embedInput.js';

const SNOWFLAKE_RE = /^\d{17,20}$/;

export function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && SNOWFLAKE_RE.test(value);
}

function isEmbedInput(value: unknown): value is DiscordEmbedInput {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function parseEmbeds(value: unknown): DiscordEmbedInput[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every(isEmbedInput)) {
    return null;
  }
  return value;
}
