import OpenAI from 'openai';
import type {
    memberProfileModerationDetail,
    memberProfileModerationImage,
    StoredMemberJoinEvent,
} from '#server/types/memberJoinData.js';
import type { MemberProfileModerationFilterSettings } from '#server/types/memberFilterSettings.js';

const MODERATION_MODEL = 'omni-moderation-latest';

type ModerationResult = OpenAI.Moderations.ModerationCreateResponse['results'][number];

const CUSTOM_THRESHOLD_CATEGORIES = [
    'harassment',
    'harassment/threatening',
    'sexual',
    'hate',
    'hate/threatening',
    'illicit',
    'illicit/violent',
    'self-harm/intent',
    'self-harm/instructions',
    'self-harm',
    'sexual/minors',
    'violence',
    'violence/graphic',
] as const satisfies readonly (keyof MemberProfileModerationFilterSettings)[];

let openaiClient: OpenAI | null | undefined;

function getOpenAIClient(): OpenAI | null {
    if (openaiClient !== undefined) {
        return openaiClient;
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    openaiClient = apiKey ? new OpenAI({ apiKey }) : null;
    return openaiClient;
}

function collectModerationName(event: StoredMemberJoinEvent): string {
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

    add(event.displayName);
    add(event.globalName);
    add(event.username);
    add(event.nickname);

    return parts.join('\n');
}

function isResultFiltered(
    result: ModerationResult,
    settings: MemberProfileModerationFilterSettings,
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
                type: 'image_url',
                image_url: { url },
            },
        ],
    });
    return response.results[0] ?? null;
}

export async function applyMemberProfileModerationFilter(
    event: StoredMemberJoinEvent,
    settings: MemberProfileModerationFilterSettings,
): Promise<void> {
    const client = getOpenAIClient();
    let flaggedCount = 0;

    if (!client) {
        event.memberProfileModerationFilter = {
            isFiltered: false,
            flaggedCount: 0,
        };
        event.memberProfileModerationDetail = {
            name: null,
            icon: null,
        };
        return;
    }

    let nameResult: ModerationResult | null = null;
    let iconResult: memberProfileModerationImage | null = null;

    if (settings.isFilterAppliedToName) {
        const text = collectModerationName(event);
        if (text) {
            try {
                nameResult = await moderateText(client, text);
                if (nameResult && isResultFiltered(nameResult, settings)) {
                    flaggedCount += 1;
                }
            } catch {
                nameResult = null;
            }
        }
    }

    if (settings.isFilterAppliedToIcon && event.avatarURL) {
        try {
            const result = await moderateImage(client, event.avatarURL);
            iconResult = { url: event.avatarURL, moderation: result };
            if (result && isResultFiltered(result, settings)) {
                flaggedCount += 1;
            }
        } catch {
            iconResult = { url: event.avatarURL, moderation: null };
        }
    }

    const detail: memberProfileModerationDetail = {
        name: nameResult,
        icon: iconResult,
    };

    event.memberProfileModerationDetail = detail;
    event.memberProfileModerationFilter = {
        isFiltered: flaggedCount > 0,
        flaggedCount,
    };
}
