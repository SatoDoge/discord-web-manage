import { Message } from "discord.js";
import { getWordFilterSettings } from "#server/stores/messageFilterSettingsStore.js";

export async function handleWordFilter(message: Message) {
    const wordFilterSettings = await getWordFilterSettings();
    if (!wordFilterSettings.isEnabled) return;
    if (
        (wordFilterSettings.channelIdList.includes(message.channel.id) &&
            wordFilterSettings.channelListType === "block") ||
        (!wordFilterSettings.channelIdList.includes(message.channel.id) &&
            wordFilterSettings.channelListType === "allow")
    ) {
        return;
    }
}
