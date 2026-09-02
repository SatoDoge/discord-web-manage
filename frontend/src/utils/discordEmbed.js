const MAX_EMBEDS = 10;

function asTrimmedString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeColor(color) {
    if (typeof color !== 'number' || !Number.isFinite(color)) {
        return null;
    }
    return `#${Math.max(0, color).toString(16).padStart(6, '0').slice(-6)}`;
}

function normalizeTimestamp(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Date.parse(value.trim());
        if (!Number.isNaN(parsed)) {
            return new Date(parsed).toISOString();
        }
        return value.trim();
    }
    return null;
}

function normalizeEmbed(embed) {
    if (!embed || typeof embed !== 'object' || Array.isArray(embed)) {
        return null;
    }

    const normalized = {
        title: asTrimmedString(embed.title),
        description: asTrimmedString(embed.description),
        url: asTrimmedString(embed.url),
        color: normalizeColor(embed.color),
        timestamp: normalizeTimestamp(embed.timestamp),
        footer: null,
        image: null,
        thumbnail: null,
        author: null,
        fields: []
    };

    if (embed.footer && typeof embed.footer === 'object') {
        const text = asTrimmedString(embed.footer.text);
        if (text) {
            normalized.footer = {
                text,
                iconURL: asTrimmedString(embed.footer.iconURL) || asTrimmedString(embed.footer.icon_url)
            };
        }
    }

    if (embed.image && typeof embed.image === 'object') {
        const url = asTrimmedString(embed.image.url);
        if (url) {
            normalized.image = { url };
        }
    }

    if (embed.thumbnail && typeof embed.thumbnail === 'object') {
        const url = asTrimmedString(embed.thumbnail.url);
        if (url) {
            normalized.thumbnail = { url };
        }
    }

    if (embed.author && typeof embed.author === 'object') {
        const name = asTrimmedString(embed.author.name);
        if (name) {
            normalized.author = {
                name,
                url: asTrimmedString(embed.author.url),
                iconURL: asTrimmedString(embed.author.iconURL) || asTrimmedString(embed.author.icon_url)
            };
        }
    }

    if (Array.isArray(embed.fields)) {
        normalized.fields = embed.fields
            .map((field) => {
                const name = asTrimmedString(field?.name);
                const value = asTrimmedString(field?.value);
                if (!name || !value) {
                    return null;
                }
                return {
                    name,
                    value,
                    inline: field.inline === true
                };
            })
            .filter(Boolean);
    }

    const hasContent =
        normalized.title ||
        normalized.description ||
        normalized.url ||
        normalized.timestamp ||
        normalized.color ||
        normalized.footer ||
        normalized.image ||
        normalized.thumbnail ||
        normalized.author ||
        normalized.fields.length > 0;

    return hasContent ? normalized : null;
}

/**
 * Parse embed JSON from the composer textarea.
 */
export function parseEmbedJsonInput(text) {
    const trimmed = text?.trim();
    if (!trimmed) {
        return { ok: false, error: 'empty' };
    }

    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return { ok: false, error: 'invalid_json' };
    }

    const embeds = Array.isArray(parsed) ? parsed : [parsed];
    if (!embeds.length || embeds.length > MAX_EMBEDS) {
        return { ok: false, error: 'invalid_embed_count' };
    }

    const normalized = embeds.map(normalizeEmbed);
    if (normalized.some((embed) => embed == null)) {
        return { ok: false, error: 'invalid_embed' };
    }

    return { ok: true, embeds: normalized, payload: embeds };
}

export const DEFAULT_EMBED_TEMPLATE = `[
  {
    "title": "Title",
    "description": "Description text",
    "color": 5814783,
    "fields": [
      { "name": "Field", "value": "Value", "inline": true }
    ],
    "footer": { "text": "Footer" }
  }
]`;
