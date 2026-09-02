import { ActivityType, type PresenceStatusData } from 'discord.js';
import {
  updateClientActivities,
  updateClientStatus,
} from '#server/discord/updateClientStatus.js';
import { getDiscordClient } from '#server/discord.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

const VALID_STATUSES = new Set<PresenceStatusData>([
  'online',
  'idle',
  'dnd',
  'invisible',
]);

export type ActivityUpdateInput = {
  name: string;
  type: ActivityType;
  state?: string | null;
};

export type PresenceUpdateInput = {
  status?: PresenceStatusData;
  activity?: ActivityUpdateInput | null;
};

export type PresenceUpdateResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'bot_not_connected'
        | 'invalid_status'
        | 'invalid_activity_type'
        | 'invalid_activity_name';
    };

function isBotReady(): boolean {
  const client = getDiscordClient();
  return Boolean(client?.isReady());
}

function validateActivity(activity: ActivityUpdateInput): PresenceUpdateResult | null {
  if (!Number.isInteger(activity.type) || activity.type < 0 || activity.type > 5) {
    return { ok: false, error: 'invalid_activity_type' };
  }

  if (activity.type === ActivityType.Custom) {
    if (!activity.state?.trim()) {
      return { ok: false, error: 'invalid_activity_name' };
    }
    return null;
  }

  if (!activity.name?.trim()) {
    return { ok: false, error: 'invalid_activity_name' };
  }

  return null;
}

/** Apply presence status and/or activity updates to the Discord bot. */
export function applyPresenceUpdate(
  input: PresenceUpdateInput,
  context: AuthenticatedServiceContext,
): PresenceUpdateResult {
  const logFailure = (error: string) => {
    recordAuthenticatedAdminOperation(context, {
      action: 'bot.presence_update',
      category: 'settings',
      success: false,
      errorMessage: error,
      summary: 'ボットのステータス更新に失敗しました',
      metadata: { input },
    });
  };

  if (input.status !== undefined && !VALID_STATUSES.has(input.status)) {
    logFailure('invalid_status');
    return { ok: false, error: 'invalid_status' };
  }

  if (input.activity !== undefined && input.activity !== null) {
    const activityError = validateActivity(input.activity);
    if (activityError && !activityError.ok) {
      logFailure(activityError.error);
      return activityError;
    }
  }

  if (!isBotReady()) {
    logFailure('bot_not_connected');
    return { ok: false, error: 'bot_not_connected' };
  }

  if (input.status !== undefined && input.activity !== undefined) {
    const client = getDiscordClient();
    client!.user!.setPresence({
      status: input.status,
      activities:
        input.activity === null
          ? []
          : [
              {
                name: input.activity.name.trim(),
                type: input.activity.type,
                state: input.activity.state?.trim() ?? undefined,
              },
            ],
    });
    recordAuthenticatedAdminOperation(context, {
      action: 'bot.presence_update',
      category: 'settings',
      success: true,
      summary: 'ボットのステータスを更新しました',
      metadata: { input },
    });
    return { ok: true };
  }

  if (input.status !== undefined) {
    if (!updateClientStatus(input.status)) {
      logFailure('bot_not_connected');
      return { ok: false, error: 'bot_not_connected' };
    }
  }

  if (input.activity !== undefined) {
    const activities =
      input.activity === null
        ? []
        : [
            {
              name: input.activity.name.trim(),
              type: input.activity.type,
              state: input.activity.state?.trim() ?? null,
            },
          ];

    if (!updateClientActivities(activities)) {
      logFailure('bot_not_connected');
      return { ok: false, error: 'bot_not_connected' };
    }
  }

  recordAuthenticatedAdminOperation(context, {
    action: 'bot.presence_update',
    category: 'settings',
    success: true,
    summary: 'ボットのステータスを更新しました',
    metadata: { input },
  });

  return { ok: true };
}
