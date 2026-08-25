import { getDiscordClient } from '#server/discord.js';
import { Events, type Presence } from 'discord.js';
import { Logger } from '#server/utils/logger.js';
import {
  getMember,
  updateMemberPresence,
} from '#server/stores/memberStore.js';
import {
  isTargetGuild,
  toStoredPresence,
} from '#server/discord/toStoredMember.js';

const logger = new Logger('discord.event.onPresenceUpdate');

export function onPresenceUpdate() {
  const client = getDiscordClient();
  if (!client) {
    logger.error('Discord client not found');
    return;
  }
  client.on(Events.PresenceUpdate, (oldPresence, newPresence) => {
    void handlePresenceUpdate(oldPresence, newPresence);
  });
}

export async function handlePresenceUpdate(
  _oldPresence: Presence | null,
  newPresence: Presence,
): Promise<void> {
  const guildId = newPresence.guild?.id;
  if (!guildId || !isTargetGuild(guildId)) {
    return;
  }

  const userId = newPresence.userId;
  const tag = newPresence.user?.tag ?? userId;
  logger.info(`Presence updated: ${tag} (${userId}) → ${newPresence.status}`);

  try {
    const existing = await getMember(userId);
    if (!existing) {
      logger.warn(`Member ${userId} (${tag}) not in store; skip presence update`);
      return;
    }

    const now = new Date().toISOString();
    await updateMemberPresence(userId, toStoredPresence(newPresence, now));
    logger.info(`Updated presence for ${userId} (${tag})`);
  } catch (error) {
    logger.error(`Failed to update presence for ${userId}: ${String(error)}`);
  }
}
