import { getDiscordClient } from '#server/discord.js';
import {
  Events,
  type GuildMember,
  type PartialGuildMember,
} from 'discord.js';
import { Logger } from '#server/utils/logger.js';
import { removeMember } from '#server/stores/memberStore.js';
import { isTargetGuild } from '#server/discord/toStoredMember.js';

const logger = new Logger('discord.event.onGuildMemberRemove');

export function onGuildMemberRemove() {
  const client = getDiscordClient();
  if (!client) {
    logger.error('Discord client not found');
    return;
  }
  client.on(Events.GuildMemberRemove, (member) => {
    void handleMemberRemove(member);
  });
}

export async function handleMemberRemove(
  member: GuildMember | PartialGuildMember,
): Promise<void> {
  if (!isTargetGuild(member.guild.id)) {
    return;
  }

  const tag = member.user?.tag ?? member.id;
  logger.info(`Member left: ${tag} (${member.id})`);

  try {
    const removed = await removeMember(member.id);
    if (!removed) {
      logger.warn(`Member ${member.id} (${tag}) not in store; skip remove`);
      return;
    }
    logger.info(`Removed member ${member.id} (${tag})`);
  } catch (error) {
    logger.error(`Failed to remove member ${member.id}: ${String(error)}`);
  }
}
