import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';
import type { JoinDelayFilterSettings } from '#server/types/memberFilterSettings.js';

export function applyJoinDelayFilter(
    event: StoredMemberJoinEvent,
    joinDelayFilterSettings: JoinDelayFilterSettings,
): void {
    const requiredDelaySeconds = joinDelayFilterSettings.joinDelaySeconds;

    if (requiredDelaySeconds === null) {
        event.joinDelayFilter = {
            isFiltered: false,
            accountAgeSeconds: 0,
            requiredDelaySeconds: 0,
        };
        return;
    }

    const accountCreatedMs = new Date(event.accountCreatedAt).getTime();
    const joinedMs = new Date(event.joinedAt).getTime();
    const accountAgeSeconds = Math.max(
        0,
        Math.floor((joinedMs - accountCreatedMs) / 1_000),
    );

    event.joinDelayFilter = {
        isFiltered: accountAgeSeconds < requiredDelaySeconds,
        accountAgeSeconds,
        requiredDelaySeconds,
    };
}
