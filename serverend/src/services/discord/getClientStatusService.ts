import { getDiscordClient } from '#server/discord.js';
import type { ClientStatus } from '#server/discord/getClientStatus.js';
import { getMember } from '#server/stores/memberStore.js';

export type { ClientStatus };

/** Bot status derived from the stored guild member row (plus live connection flag). */
export async function fetchClientStatus(): Promise<ClientStatus> {
  const client = getDiscordClient();
  if (!client?.isReady() || !client.user) {
    return {
      isConnected: false,
      userId: null,
      username: null,
      avatarURL: null,
      status: null,
      activities: null,
    };
  }

  const member = await getMember(client.user.id);
  if (!member) {
    return {
      isConnected: true,
      userId: client.user.id,
      username: null,
      avatarURL: null,
      status: null,
      activities: null,
    };
  }

  return {
    isConnected: true,
    userId: member.id,
    username: member.username,
    avatarURL: member.avatarURL,
    status: member.presence?.status ?? null,
    activities:
      member.presence?.activities.map((activity) => ({
        name: activity.name,
        type: activity.type,
        state: activity.state,
        emoji: activity.emoji
          ? {
              name: activity.emoji.name,
              id: activity.emoji.id,
            }
          : null,
      })) ?? null,
  };
}
