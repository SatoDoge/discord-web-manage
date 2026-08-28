import { getWordFilterSettings } from "#server/stores/messageFilterSettingsStore.js";
import type { StoredGuildMessage } from "#server/types/messageData.js";
import type { WordFilterSettings } from "#server/types/messageFilterSettings.js";

const URL_IN_TEXT_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectSearchableText(message: StoredGuildMessage): string[] {
    const texts = [message.content, message.cleanContent];

    for (const embed of message.embeds) {
        if (embed.title) texts.push(embed.title);
        if (embed.description) texts.push(embed.description);
        if (embed.author?.name) texts.push(embed.author.name);
        if (embed.footer?.text) texts.push(embed.footer.text);
        for (const field of embed.fields) {
            texts.push(field.name, field.value);
        }
    }

    for (const attachment of message.attachments) {
        if (attachment.filename) texts.push(attachment.filename);
        if (attachment.description) texts.push(attachment.description);
    }

    return texts.filter(Boolean);
}

function collectUrls(message: StoredGuildMessage): string[] {
    const urls = new Set<string>();

    for (const text of collectSearchableText(message)) {
        for (const match of text.matchAll(URL_IN_TEXT_PATTERN)) {
            urls.add(match[0]);
        }
    }

    for (const attachment of message.attachments) {
        urls.add(attachment.url);
        urls.add(attachment.proxyURL);
    }

    for (const embed of message.embeds) {
        if (embed.url) urls.add(embed.url);
        if (embed.author?.url) urls.add(embed.author.url);
        if (embed.imageURL) urls.add(embed.imageURL);
        if (embed.thumbnailURL) urls.add(embed.thumbnailURL);
        if (embed.videoURL) urls.add(embed.videoURL);
        if (embed.provider?.url) urls.add(embed.provider.url);
    }

    return [...urls];
}

function matchesUrlPattern(url: string, pattern: string): boolean {
    const normalizedUrl = url.trim();
    const normalizedPattern = pattern.trim();
    if (!normalizedPattern || !normalizedUrl) {
        return false;
    }

    if (normalizedPattern.endsWith("*")) {
        const prefix = normalizedPattern.slice(0, -1);
        if (normalizedUrl.startsWith(prefix)) {
            return true;
        }
        if (prefix.endsWith("/")) {
            return normalizedUrl === prefix.slice(0, -1);
        }
        return false;
    }

    const regex = new RegExp(`^${escapeRegExp(normalizedPattern)}$`, "i");
    return regex.test(normalizedUrl);
}

function countWordMatches(text: string, word: string): number {
    if (!word) {
        return 0;
    }

    const regex = new RegExp(escapeRegExp(word), "gi");
    return [...text.matchAll(regex)].length;
}

function findBlockedWords(
    texts: string[],
    wordFilterList: string[],
): { filteredWords: string[]; filteredWordCount: number } {
    const filteredWords: string[] = [];
    let filteredWordCount = 0;

    for (const word of wordFilterList) {
        const trimmedWord = word.trim();
        if (!trimmedWord) {
            continue;
        }

        let matchCount = 0;
        for (const text of texts) {
            matchCount += countWordMatches(text, trimmedWord);
        }

        if (matchCount > 0) {
            filteredWords.push(trimmedWord);
            filteredWordCount += matchCount;
        }
    }

    return { filteredWords, filteredWordCount };
}

function findBlockedUrls(
    urls: string[],
    urlFilterList: string[],
): { filteredWords: string[]; filteredWordCount: number } {
    const filteredWords: string[] = [];
    let filteredWordCount = 0;

    for (const pattern of urlFilterList) {
        const trimmedPattern = pattern.trim();
        if (!trimmedPattern) {
            continue;
        }

        let matchCount = 0;
        for (const url of urls) {
            if (matchesUrlPattern(url, trimmedPattern)) {
                matchCount += 1;
            }
        }

        if (matchCount > 0) {
            filteredWords.push(trimmedPattern);
            filteredWordCount += matchCount;
        }
    }

    return { filteredWords, filteredWordCount };
}

export function applyWordFilter(
    message: StoredGuildMessage,
    wordFilterSettings: WordFilterSettings,
): void {
    const texts = collectSearchableText(message);
    const urls = collectUrls(message);

    const blockedWords = findBlockedWords(texts, wordFilterSettings.wordFilterList);
    const blockedUrls = findBlockedUrls(urls, wordFilterSettings.urlFilterList);

    const filteredWords = [...blockedWords.filteredWords, ...blockedUrls.filteredWords];
    const filteredWordCount = blockedWords.filteredWordCount + blockedUrls.filteredWordCount;

    message.wordFilter = {
        isFiltered: filteredWordCount > 0,
        filteredWords,
        filteredWordCount,
    };
}

export async function handleWordFilter(message: StoredGuildMessage) {
    const wordFilterSettings = await getWordFilterSettings();
    if (!wordFilterSettings.isEnabled) return;
    if (
        (wordFilterSettings.channelIdList.includes(message.channelId) &&
            wordFilterSettings.channelListType === "block") ||
        (!wordFilterSettings.channelIdList.includes(message.channelId) &&
            wordFilterSettings.channelListType === "allow")
    ) {
        return;
    }

    applyWordFilter(message, wordFilterSettings);
}
