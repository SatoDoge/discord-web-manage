import { getDiscordClient } from "#server/discord.js";
import { PresenceStatusData , ActivityType } from "discord.js";

export function updateClientStatus(status: PresenceStatusData): boolean {
    const client = getDiscordClient();
    if (!client || !client.isReady()) {
        return false;
    }

    client.user.setStatus(status);
    return true;
}

export function updateClientActivities(
    activities: {
        name: string;
        type: ActivityType;
        state?: string | null;
    }[],
): boolean {
    const client = getDiscordClient();
    if (!client || !client.isReady()) {
        return false;
    }

    client.user.setPresence({
        activities: activities.map((activity) => ({
            name: activity.name,
            type: activity.type,
            state: activity.state ?? undefined,
        })),
    });
    return true;
}
