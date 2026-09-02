import { EmbedBuilder, type EmbedData } from 'discord.js';
import type {
  DiscordEmbedAuthorInput,
  DiscordEmbedFieldInput,
  DiscordEmbedFooterInput,
  DiscordEmbedImageInput,
  DiscordEmbedInput,
} from '#server/discord/types/embedInput.js';

export type BuildEmbedsError = 'too_many_embeds' | 'invalid_embed';

export type BuildEmbedsResult =
  | { ok: true; embeds: EmbedBuilder[] }
  | { ok: false; error: BuildEmbedsError };

const MAX_EMBEDS = 10;

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
    return trimmed;
  }
  return undefined;
}

function normalizeImage(
  image: DiscordEmbedImageInput | undefined,
): EmbedData['image'] | undefined {
  const url = asTrimmedString(image?.url);
  return url ? { url } : undefined;
}

function normalizeAuthor(
  author: DiscordEmbedAuthorInput | undefined,
): EmbedData['author'] | undefined {
  const name = asTrimmedString(author?.name);
  if (!name) {
    return undefined;
  }

  const iconURL =
    asTrimmedString(author?.iconURL) ?? asTrimmedString(author?.icon_url);

  return {
    name,
    url: asTrimmedString(author?.url),
    iconURL,
  };
}

function normalizeFooter(
  footer: DiscordEmbedFooterInput | undefined,
): EmbedData['footer'] | undefined {
  const text = asTrimmedString(footer?.text);
  if (!text) {
    return undefined;
  }

  const iconURL =
    asTrimmedString(footer?.iconURL) ?? asTrimmedString(footer?.icon_url);

  return {
    text,
    iconURL,
  };
}

function normalizeFields(
  fields: DiscordEmbedFieldInput[] | undefined,
): EmbedData['fields'] | undefined {
  if (!Array.isArray(fields) || fields.length === 0) {
    return undefined;
  }

  const normalized = fields
    .map((field) => {
      const name = asTrimmedString(field.name);
      const value = asTrimmedString(field.value);
      if (!name || !value) {
        return null;
      }
      return {
        name,
        value,
        inline: field.inline === true,
      };
    })
    .filter((field): field is NonNullable<typeof field> => field != null);

  return normalized.length > 0 ? normalized : undefined;
}

function hasEmbedContent(data: EmbedData): boolean {
  return Boolean(
    data.title ||
      data.description ||
      data.url ||
      data.timestamp ||
      data.color != null ||
      data.footer ||
      data.image ||
      data.thumbnail ||
      data.author ||
      (data.fields && data.fields.length > 0),
  );
}

function normalizeEmbedInput(input: DiscordEmbedInput): EmbedData | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const data: EmbedData = {
    title: asTrimmedString(input.title),
    description: asTrimmedString(input.description),
    url: asTrimmedString(input.url),
    timestamp: normalizeTimestamp(input.timestamp),
    color: typeof input.color === 'number' && Number.isFinite(input.color)
      ? input.color
      : undefined,
    footer: normalizeFooter(input.footer),
    image: normalizeImage(input.image),
    thumbnail: normalizeImage(input.thumbnail),
    author: normalizeAuthor(input.author),
    fields: normalizeFields(input.fields),
  };

  return hasEmbedContent(data) ? data : null;
}

/** Convert generic embed payloads into Discord.js embed builders. */
export function buildEmbeds(embeds: DiscordEmbedInput[]): BuildEmbedsResult {
  if (!Array.isArray(embeds)) {
    return { ok: false, error: 'invalid_embed' };
  }
  if (embeds.length > MAX_EMBEDS) {
    return { ok: false, error: 'too_many_embeds' };
  }

  const builders: EmbedBuilder[] = [];
  for (const embed of embeds) {
    const data = normalizeEmbedInput(embed);
    if (!data) {
      return { ok: false, error: 'invalid_embed' };
    }
    builders.push(new EmbedBuilder(data));
  }

  return { ok: true, embeds: builders };
}
