export const ACTIVITY_LABELS = {
    0: 'Playing',
    1: 'Streaming',
    2: 'Listening to',
    3: 'Watching',
    4: 'Custom',
    5: 'Competing in'
};

export const ACTIVITY_TYPE_OPTIONS = [
    { label: 'Playing', value: 0 },
    { label: 'Streaming', value: 1 },
    { label: 'Listening to', value: 2 },
    { label: 'Watching', value: 3 },
    { label: 'Custom Status', value: 4 },
    { label: 'Competing in', value: 5 }
];

export const PRESENCE_STATUS_OPTIONS = [
    { label: 'Online', value: 'online', dotClass: 'status-dot--online' },
    { label: 'Idle', value: 'idle', dotClass: 'status-dot--idle' },
    { label: 'Do Not Disturb', value: 'dnd', dotClass: 'status-dot--dnd' },
    { label: 'Invisible', value: 'invisible', dotClass: 'status-dot--offline' }
];

/**
 * @param {{ name: string; type: number; state: string | null } | null | undefined} activity
 */
export function formatDiscordActivity(activity) {
    if (!activity) {
        return 'No activity set';
    }

    if (activity.type === 4) {
        return activity.state ?? activity.name ?? 'No activity set';
    }

    const prefix = ACTIVITY_LABELS[activity.type] ?? 'Activity';
    return `${prefix} ${activity.name}`;
}

/**
 * @param {string | null | undefined} status
 */
export function formatPresenceStatus(status) {
    return PRESENCE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Unknown';
}
