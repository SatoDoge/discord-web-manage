import { getDiscordClient } from "#server/discord.js";
import { ActivityType } from "discord.js";
import { Logger } from "#server/utils/logger.js";
const logger = new Logger("discord/getClientStatus");
type PresenceStatus = "online" | "idle" | "dnd" | "offline";

export type ClientStatus = {
    isConnected: boolean;
    userId: string | null;
    username: string | null;
    avatarURL: string | null;
    status: PresenceStatus | null;
    activities: {
        name: string;
        type: ActivityType;
        state: string | null;
        emoji: {
            name: string | null;
            id: string | null;
        } | null;
    }[] | null;
};

export function getClientStatus(): ClientStatus {
    const client = getDiscordClient();
    if (!client || !client.isReady()) {
        if (!client) {
            logger.error("Discord client is not initialized");
        }
        if (!client?.isReady()) {
            logger.error("Discord client is not ready");
        }
        return {
            isConnected: false,
            userId: null,
            username: null,
            avatarURL: null,
            status: null,
            activities: null,
        };
    }

    const presence = client.user.presence;

    return {
        isConnected: true,
        userId: client.user.id,
        username: client.user.username,
        avatarURL: client.user.displayAvatarURL(),
        status: presence.status as PresenceStatus | null,
        activities: presence.activities.map((activity) => ({
            name: activity.name,
            type: activity.type,
            state: activity.state,
            emoji: activity.emoji
                ? {
                    name: activity.emoji.name,
                    id: activity.emoji.id,
                }
                : null,
        })),
    };
}