import { getDiscordClient } from '#server/discord.js';
import { Events, type GuildMember } from 'discord.js';
import { Logger } from '#server/utils/logger.js';
import { addMember, getMember, updateMember } from '#server/stores/memberStore.js';
import {
  isTargetGuild,
  toStoredGuildMember,
  toStoredPresence,
} from '#server/discord/toStoredMember.js';

const logger = new Logger('discord.event.onGuildMemberAdd');

export function onGuildMemberAdd() {
  const client = getDiscordClient();
  if (!client) {
    logger.error('Discord client not found');
    return;
  }
  client.on(Events.GuildMemberAdd, (member) => {
    void handleMemberAdd(member);
  });
}

export async function handleMemberAdd(member: GuildMember): Promise<void> {
  if (!isTargetGuild(member.guild.id)) {
    return;
  }

  const tag = member.user.tag;
  logger.info(`Member joined: ${tag} (${member.id})`);

  try {
    const now = new Date().toISOString();
    const presence = member.presence
      ? toStoredPresence(member.presence, now)
      : null;
    const stored = toStoredGuildMember(member, presence, {
      firstSeenAt: now,
      profileUpdatedAt: now,
      memberUpdatedAt: now,
      lastSyncedAt: now,
    });

    const existing = await getMember(member.id);
    if (existing) {
      // Re-join while still in DB (e.g. remove missed): refresh the row.
      await updateMember({
        ...stored,
        firstSeenAt: existing.firstSeenAt,
        presence: presence ?? existing.presence,
      });
      logger.info(`Refreshed existing member ${member.id} (${tag})`);
      return;
    }

    await addMember(stored);
    logger.info(`Added member ${member.id} (${tag})`);
  } catch (error) {
    logger.error(`Failed to add member ${member.id}: ${String(error)}`);
  }
}
