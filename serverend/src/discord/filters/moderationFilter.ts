import OpenAI from "openai";
import { getModerationFilterSettings } from "#server/stores/messageFilterSettingsStore.js";
import type { moderationImage, StoredGuildMessage } from "#server/types/messageData.js";
import type { ModerationFilterSettings } from "#server/types/messageFilterSettings.js";

const MODERATION_MODEL = "omni-moderation-latest";

type ModerationResult = OpenAI.Moderations.ModerationCreateResponse["results"][number];

const CUSTOM_THRESHOLD_CATEGORIES = [
    "harassment",
    "harassment/threatening",
    "sexual",
    "hate",
    "hate/threatening",
    "illicit",
    "illicit/violent",
    "self-harm/intent",
    "self-harm/instructions",
    "self-harm",
    "sexual/minors",
    "violence",
    "violence/graphic",
] as const satisfies readonly (keyof ModerationFilterSettings)[];

let openaiClient: OpenAI | null | undefined;

function getOpenAIClient(): OpenAI | null {
    if (openaiClient !== undefined) {
        return openaiClient;
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    openaiClient = apiKey ? new OpenAI({ apiKey }) : null;
    return openaiClient;
}

function collectModerationText(message: StoredGuildMessage): string {
    const parts: string[] = [];
    const seen = new Set<string>();

    const add = (text: string | null | undefined) => {
        const trimmed = text?.trim();
        if (!trimmed || seen.has(trimmed)) {
            return;
        }
        seen.add(trimmed);
        parts.push(trimmed);
    };

    add(message.cleanContent);
    add(message.content);

    for (const embed of message.embeds) {
        add(embed.title);
        add(embed.description);
        add(embed.author?.name);
        add(embed.footer?.text);
        for (const field of embed.fields) {
            add(field.name);
            add(field.value);
        }
    }

    for (const attachment of message.attachments) {
        add(attachment.filename);
        add(attachment.description);
    }

    return parts.join("\n");
}

function isImageAttachment(contentType: string | null, filename: string | null): boolean {
    if (contentType?.startsWith("image/")) {
        return true;
    }
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename ?? "");
}

function collectImageUrls(message: StoredGuildMessage): string[] {
    const urls = new Set<string>();

    for (const attachment of message.attachments) {
        if (isImageAttachment(attachment.contentType, attachment.filename)) {
            urls.add(attachment.url);
        }
    }

    for (const embed of message.embeds) {
        if (embed.imageURL) {
            urls.add(embed.imageURL);
        }
        if (embed.thumbnailURL) {
            urls.add(embed.thumbnailURL);
        }
    }

    return [...urls];
}

function isResultFiltered(
    result: ModerationResult,
    settings: ModerationFilterSettings,
): boolean {
    if (!settings.isUseCustomFlag) {
        return result.flagged;
    }

    for (const category of CUSTOM_THRESHOLD_CATEGORIES) {
        const threshold = settings[category];
        if (threshold === null) {
            continue;
        }
        if (result.category_scores[category] >= threshold) {
            return true;
        }
    }

    return false;
}

async function moderateText(
    client: OpenAI,
    text: string,
): Promise<ModerationResult | null> {
    const response = await client.moderations.create({
        model: MODERATION_MODEL,
        input: text,
    });
    return response.results[0] ?? null;
}

async function moderateImage(
    client: OpenAI,
    url: string,
): Promise<ModerationResult | null> {
    const response = await client.moderations.create({
        model: MODERATION_MODEL,
        input: [
            {
                type: "image_url",
                image_url: { url },
            },
        ],
    });
    return response.results[0] ?? null;
}

export async function applyModerationFilter(
    message: StoredGuildMessage,
    moderationFilterSettings: ModerationFilterSettings,
): Promise<void> {
    const client = getOpenAIClient();
    let flaggedCount = 0;

    if (!client) {
        message.moderationFilter = {
            isFiltered: false,
            messageCount: 0,
        };
        message.multipleMessageFilter = {
            content: null,
            image: null,
        };
        return;
    }

    let contentResult: ModerationResult | null = null;
    let imageResults: moderationImage[] | null = null;

    if (moderationFilterSettings.isFilterAppliedToContent) {
        const text = collectModerationText(message);
        if (text) {
            try {
                contentResult = await moderateText(client, text);
                if (contentResult && isResultFiltered(contentResult, moderationFilterSettings)) {
                    flaggedCount += 1;
                }
            } catch {
                contentResult = null;
            }
        }
    }

    if (moderationFilterSettings.isFilterAppliedToImage) {
        const imageUrls = collectImageUrls(message);
        if (imageUrls.length > 0) {
            imageResults = [];
            for (const url of imageUrls) {
                try {
                    const result = await moderateImage(client, url);
                    imageResults.push({ url, moderation: result });
                    if (result && isResultFiltered(result, moderationFilterSettings)) {
                        flaggedCount += 1;
                    }
                } catch {
                    imageResults.push({ url, moderation: null });
                }
            }
        }
    }

    message.multipleMessageFilter = {
        content: contentResult,
        image: imageResults,
    };
    message.moderationFilter = {
        isFiltered: flaggedCount > 0,
        messageCount: flaggedCount,
    };
}

export async function handleModerationFilter(message: StoredGuildMessage) {
    const moderationFilterSettings = await getModerationFilterSettings();
    if (!moderationFilterSettings.isEnabled) return;
    if (
        (moderationFilterSettings.channelIdList.includes(message.channelId) &&
            moderationFilterSettings.channelListType === "block") ||
        (!moderationFilterSettings.channelIdList.includes(message.channelId) &&
            moderationFilterSettings.channelListType === "allow")
    ) {
        return;
    }

    await applyModerationFilter(message, moderationFilterSettings);
}
