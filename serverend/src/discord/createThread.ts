import {
  ChannelType,
  PermissionsBitField,
  ThreadAutoArchiveDuration,
  type ForumChannel,
  type NewsChannel,
  type TextChannel,
  type ThreadChannel,
} from 'discord.js';
import { getDiscordClient } from '#server/discord.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('discord/createThread');

export const THREAD_PARENT_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
] as const;

export const CREATABLE_THREAD_TYPES = [
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
] as const;

export type ThreadParentChannelType = (typeof THREAD_PARENT_CHANNEL_TYPES)[number];
export type CreatableThreadType = (typeof CREATABLE_THREAD_TYPES)[number];

export type CreateGuildThreadInput = {
  /** Parent text, announcement, or forum channel ID. */
  parentChannelId: string;
  name: string;
  /** Public (default) or private. Forum parents always create a forum post (public-like). */
  type?: CreatableThreadType;
  /** Required for forum channels (starter message). Optional elsewhere. */
  message?: string;
  autoArchiveDuration?: ThreadAutoArchiveDuration;
  rateLimitPerUser?: number;
  reason?: string;
};

export type GuildThreadDetail = {
  id: string;
  name: string;
  type: ChannelType;
  guildId: string;
  parentId: string | null;
  parentName: string | null;
  /** Category of the parent channel, when the parent belongs to one. */
  categoryId: string | null;
  categoryName: string | null;
  archived: boolean;
  locked: boolean;
  rateLimitPerUser: number;
  autoArchiveDuration: number | null;
  messageCount: number | null;
};

export type CreateGuildThreadError =
  | 'bot_not_connected'
  | 'guild_not_configured'
  | 'guild_not_found'
  | 'channel_not_found'
  | 'invalid_parent_type'
  | 'missing_permission'
  | 'message_required'
  | 'private_thread_not_allowed'
  | 'create_failed';

export type CreateGuildThreadResult =
  | { ok: true; data: GuildThreadDetail }
  | { ok: false; error: CreateGuildThreadError };

export function isCreatableThreadType(value: number): value is CreatableThreadType {
  return (CREATABLE_THREAD_TYPES as readonly number[]).includes(value);
}

export function isThreadAutoArchiveDuration(
  value: number,
): value is ThreadAutoArchiveDuration {
  return (
    value === ThreadAutoArchiveDuration.OneHour ||
    value === ThreadAutoArchiveDuration.OneDay ||
    value === ThreadAutoArchiveDuration.ThreeDays ||
    value === ThreadAutoArchiveDuration.OneWeek
  );
}

function toThreadDetail(thread: ThreadChannel): GuildThreadDetail {
  const parent = thread.parent;
  const category =
    parent && 'parent' in parent && parent.parent?.type === ChannelType.GuildCategory
      ? parent.parent
      : null;

  return {
    id: thread.id,
    name: thread.name,
    type: thread.type,
    guildId: thread.guildId,
    parentId: thread.parentId,
    parentName: parent?.name ?? null,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    archived: thread.archived ?? false,
    locked: thread.locked ?? false,
    rateLimitPerUser: thread.rateLimitPerUser ?? 0,
    autoArchiveDuration: thread.autoArchiveDuration ?? null,
    messageCount: thread.messageCount ?? null,
  };
}

/**
 * Create a thread under a text/announcement channel, or a forum post under a forum channel.
 * Category membership is inherited from the parent channel (returned as categoryId/categoryName).
 */
export async function createGuildThread(
  input: CreateGuildThreadInput,
  guildId = process.env.DISCORD_GUILD_ID?.trim(),
): Promise<CreateGuildThreadResult> {
  const client = getDiscordClient();
  if (!client?.isReady()) {
    logger.error('Discord client is not ready');
    return { ok: false, error: 'bot_not_connected' };
  }

  if (!guildId) {
    logger.error('DISCORD_GUILD_ID is not set');
    return { ok: false, error: 'guild_not_configured' };
  }

  try {
    const guild = await client.guilds.fetch(guildId);
    const me = await guild.members.fetchMe();

    const channel = await guild.channels.fetch(input.parentChannelId).catch(() => null);
    if (!channel) {
      return { ok: false, error: 'channel_not_found' };
    }

    const parentType = channel.type;
    if (
      parentType !== ChannelType.GuildText &&
      parentType !== ChannelType.GuildAnnouncement &&
      parentType !== ChannelType.GuildForum
    ) {
      return { ok: false, error: 'invalid_parent_type' };
    }

    const threadType = input.type ?? ChannelType.PublicThread;
    const message = input.message?.trim() || undefined;
    const reason = input.reason?.trim() || undefined;

    if (parentType === ChannelType.GuildForum) {
      if (!message) {
        return { ok: false, error: 'message_required' };
      }
      if (threadType === ChannelType.PrivateThread) {
        return { ok: false, error: 'private_thread_not_allowed' };
      }
      const forumChannel = channel as ForumChannel;
      if (!me.permissionsIn(forumChannel).has(PermissionsBitField.Flags.SendMessages)) {
        return { ok: false, error: 'missing_permission' };
      }

      const thread = await forumChannel.threads.create({
        name: input.name.trim(),
        message: { content: message },
        autoArchiveDuration: input.autoArchiveDuration,
        rateLimitPerUser: input.rateLimitPerUser,
        reason,
      });

      return { ok: true, data: toThreadDetail(thread) };
    }

    if (parentType === ChannelType.GuildAnnouncement) {
      if (threadType === ChannelType.PrivateThread) {
        return { ok: false, error: 'private_thread_not_allowed' };
      }
      const newsChannel = channel as NewsChannel;
      if (!me.permissionsIn(newsChannel).has(PermissionsBitField.Flags.CreatePublicThreads)) {
        return { ok: false, error: 'missing_permission' };
      }

      const thread = await newsChannel.threads.create({
        name: input.name.trim(),
        autoArchiveDuration: input.autoArchiveDuration,
        rateLimitPerUser: input.rateLimitPerUser,
        reason,
      });

      if (message) {
        await thread.send({ content: message }).catch((error) => {
          logger.error(`Thread ${thread.id} created but first message failed: ${String(error)}`);
        });
      }

      return { ok: true, data: toThreadDetail(thread) };
    }

    const textChannel = channel as TextChannel;
    const needed =
      threadType === ChannelType.PrivateThread
        ? PermissionsBitField.Flags.CreatePrivateThreads
        : PermissionsBitField.Flags.CreatePublicThreads;
    if (!me.permissionsIn(textChannel).has(needed)) {
      return { ok: false, error: 'missing_permission' };
    }

    const thread = await textChannel.threads.create({
      name: input.name.trim(),
      type: threadType,
      autoArchiveDuration: input.autoArchiveDuration,
      rateLimitPerUser: input.rateLimitPerUser,
      reason,
    });

    if (message) {
      await thread.send({ content: message }).catch((error) => {
        logger.error(`Thread ${thread.id} created but first message failed: ${String(error)}`);
      });
    }

    return { ok: true, data: toThreadDetail(thread) };
  } catch (error) {
    logger.error(
      `Failed to create thread "${input.name}" under ${input.parentChannelId}: ${String(error)}`,
    );
    return { ok: false, error: 'create_failed' };
  }
}
