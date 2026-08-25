import { Collection, type GuildMember } from 'discord.js';
import { getMemberList } from '#server/discord/getMemberList.js';
import {
  toStoredGuildMember,
  toStoredPresence,
} from '#server/discord/toStoredMember.js';
import { updateMemberList } from '#server/stores/memberStore.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord.initMemberDB');

/**
 * Fetch every guild member from Discord and sync `memberList.json`.
 * Existing rows keep `firstSeenAt`; members no longer in the guild are dropped.
 */
export async function initMemberDB(): Promise<void> {
  logger.info('Initializing member DB from Discord…');

  const fetched = await getMemberList();
  if (!(fetched instanceof Collection) || fetched.size === 0) {
    logger.error('No members fetched; aborting member DB init');
    return;
  }

  const now = new Date().toISOString();
  const discordMembers = fetched as Collection<string, GuildMember>;

  try {
    const synced = await updateMemberList((current) => {
      const existingById = new Map(current.map((member) => [member.id, member]));

      return discordMembers.map((member) => {
        const existing = existingById.get(member.id);
        const presence = member.presence
          ? toStoredPresence(member.presence, now)
          : (existing?.presence ?? null);

        return toStoredGuildMember(member, presence, {
          firstSeenAt: existing?.firstSeenAt ?? now,
          profileUpdatedAt: now,
          memberUpdatedAt: now,
          lastSyncedAt: now,
        });
      });
    });

    logger.info(`Member DB initialized: ${synced.length} members`);
  } catch (error) {
    logger.error(`Failed to initialize member DB: ${String(error)}`);
  }
}
