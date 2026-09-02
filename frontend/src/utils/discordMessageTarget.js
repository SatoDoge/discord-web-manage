const SNOWFLAKE_RE = /\d{17,20}/;

const MESSAGE_URL_RE =
    /(?:https?:\/\/)?(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/\d+\/(\d{17,20})\/(\d{17,20})/i;

/**
 * Parse a Discord message link or "channelId/messageId" into API fields.
 */
export function parseDiscordMessageTarget(input) {
    const trimmed = input?.trim();
    if (!trimmed) {
        return { ok: false, error: 'empty' };
    }

    const urlMatch = trimmed.match(MESSAGE_URL_RE);
    if (urlMatch) {
        return {
            ok: true,
            channelId: urlMatch[1],
            messageId: urlMatch[2]
        };
    }

    const slashMatch = trimmed.match(/^(\d{17,20})\/(\d{17,20})$/);
    if (slashMatch) {
        return {
            ok: true,
            channelId: slashMatch[1],
            messageId: slashMatch[2]
        };
    }

    if (SNOWFLAKE_RE.test(trimmed) && trimmed.match(/^\d{17,20}$/)) {
        return { ok: false, error: 'message_id_only' };
    }

    return { ok: false, error: 'invalid_format' };
}
