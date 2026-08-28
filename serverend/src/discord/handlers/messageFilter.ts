import { Message } from "discord.js";
import { getWordFilterSettings, getDupliFilterSettings, getModerationFilterSettings } from "#server/stores/messageFilterSettingsStore.js";

export async function handleMessageFilter(message: Message) {
    const wordFilterSettings = await getWordFilterSettings();
    const dupliFilterSettings = await getDupliFilterSettings();
    const moderationFilterSettings = await getModerationFilterSettings();

    if (wordFilterSettings.isEnabled) {
        // handle word filter
    }
    if (dupliFilterSettings.isEnabled) {
        // handle duplicate filter
    }
    if (moderationFilterSettings.isEnabled) {
        // handle moderation filter
    }
}