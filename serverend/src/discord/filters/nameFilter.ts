import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';
import type { NameFilterSettings } from '#server/types/memberFilterSettings.js';

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countWordMatches(text: string, word: string): number {
    if (!word) {
        return 0;
    }

    const regex = new RegExp(escapeRegExp(word), 'gi');
    return [...text.matchAll(regex)].length;
}

function collectSearchableNames(event: StoredMemberJoinEvent): string[] {
    return [
        event.username,
        event.globalName,
        event.displayName,
        event.nickname,
    ].filter((value): value is string => Boolean(value?.trim()));
}

function findBlockedNames(
    names: string[],
    nameFilterList: string[],
): { matchedWords: string[]; matchCount: number } {
    const matchedWords: string[] = [];
    let matchCount = 0;

    for (const word of nameFilterList) {
        const trimmedWord = word.trim();
        if (!trimmedWord) {
            continue;
        }

        let wordMatchCount = 0;
        for (const name of names) {
            wordMatchCount += countWordMatches(name, trimmedWord);
        }

        if (wordMatchCount > 0) {
            matchedWords.push(trimmedWord);
            matchCount += wordMatchCount;
        }
    }

    return { matchedWords, matchCount };
}

export function applyNameFilter(
    event: StoredMemberJoinEvent,
    nameFilterSettings: NameFilterSettings,
): void {
    const names = collectSearchableNames(event);
    const blocked = findBlockedNames(names, nameFilterSettings.nameFilterList);

    event.nameFilter = {
        isFiltered: blocked.matchCount > 0,
        matchedWords: blocked.matchedWords,
        blockedWords: blocked.matchedWords,
        matchCount: blocked.matchCount,
    };
}
