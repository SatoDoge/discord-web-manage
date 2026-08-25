import { getDiscordClient } from '#server/discord.js';
import {
  Events,
  type GuildMember,
  type PartialGuildMember,
} from 'discord.js';
import { Logger } from '#server/utils/logger.js';
import { getMember, updateMember } from '#server/stores/memberStore.js';
import {
  isTargetGuild,
  toStoredGuildMember,
} from '#server/discord/toStoredMember.js';

const logger = new Logger('discord.event.onGuildMemberUpdate');

export function onGuildMemberUpdate() {
  const client = getDiscordClient();
  if (!client) {
    logger.error('Discord client not found');
    return;
  }
  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    void handleMemberUpdate(oldMember, newMember);
  });
}

export async function handleMemberUpdate(
  oldMember: PartialGuildMember | GuildMember,
  newMember: GuildMember,
): Promise<void> {
  if (!isTargetGuild(newMember.guild.id)) {
    return;
  }

  const tag = newMember.user.tag;
  logger.info(`${oldMember.user?.tag ?? oldMember.id} updated to ${tag}`);

  try {
    const existing = await getMember(newMember.id);
    if (!existing) {
      logger.warn(`Member ${newMember.id} (${tag}) not in store; skip update`);
      return;
    }

    const now = new Date().toISOString();
    const stored = toStoredGuildMember(newMember, existing.presence, {
      firstSeenAt: existing.firstSeenAt,
      profileUpdatedAt: existing.profileUpdatedAt,
      memberUpdatedAt: now,
      lastSyncedAt: now,
    });
    await updateMember(stored);
    logger.info(`Updated member ${newMember.id} (${tag})`);
  } catch (error) {
    logger.error(`Failed to update member ${newMember.id}: ${String(error)}`);
  }
}
