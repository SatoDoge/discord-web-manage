import {
  updateGuildChannel,
  type UpdateGuildChannelError,
  type UpdateGuildChannelInput,
} from '#server/discord/updateChannel.js';
import type { GuildChannelDetail } from '#server/discord/getChannelDetail.js';
import { invalidateChannelListCache } from '#server/services/discord/getChannelListService.js';
import { invalidateChannelDetailCache } from '#server/services/discord/getChannelDetailService.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type UpdateChannelValidationError =
  | 'invalid_channel_id'
  | 'empty_update'
  | 'invalid_name'
  | 'invalid_topic'
  | 'invalid_parent_id'
  | 'invalid_nsfw'
  | 'invalid_rate_limit'
  | 'invalid_bitrate'
  | 'invalid_user_limit'
  | 'invalid_position'
  | 'invalid_rtc_region'
  | 'invalid_reason';

export type UpdateChannelResult =
  | { ok: true; data: GuildChannelDetail }
  | {
      ok: false;
      status: number;
      error: UpdateGuildChannelError | UpdateChannelValidationError;
    };

const MAX_NAME_LENGTH = 100;
const MAX_TOPIC_LENGTH = 1024;
const MAX_RATE_LIMIT = 21600;
const MAX_BITRATE = 384000;
const MAX_USER_LIMIT = 99;

function errorStatus(error: UpdateGuildChannelError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'channel_not_found':
    case 'guild_not_found':
      return 404;
    case 'missing_permission':
      return 403;
    case 'update_failed':
      return 502;
    default:
      return 400;
  }
}

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

export type UpdateChannelBody = {
  name?: unknown;
  topic?: unknown;
  parentId?: unknown;
  nsfw?: unknown;
  rateLimitPerUser?: unknown;
  bitrate?: unknown;
  userLimit?: unknown;
  position?: unknown;
  rtcRegion?: unknown;
  reason?: unknown;
};

function parseUpdateInput(
  body: UpdateChannelBody,
):
  | { ok: true; input: UpdateGuildChannelInput }
  | { ok: false; error: Exclude<UpdateChannelValidationError, 'invalid_channel_id'> } {
  const input: UpdateGuildChannelInput = {};
  let hasField = false;

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > MAX_NAME_LENGTH) {
      return { ok: false, error: 'invalid_name' };
    }
    input.name = body.name.trim();
    hasField = true;
  }

  if (body.topic !== undefined) {
    if (body.topic !== null && typeof body.topic !== 'string') {
      return { ok: false, error: 'invalid_topic' };
    }
    if (typeof body.topic === 'string' && body.topic.length > MAX_TOPIC_LENGTH) {
      return { ok: false, error: 'invalid_topic' };
    }
    input.topic = body.topic;
    hasField = true;
  }

  if (body.parentId !== undefined) {
    if (body.parentId !== null && (typeof body.parentId !== 'string' || !isSnowflake(body.parentId))) {
      return { ok: false, error: 'invalid_parent_id' };
    }
    input.parentId = body.parentId;
    hasField = true;
  }

  if (body.nsfw !== undefined) {
    if (typeof body.nsfw !== 'boolean') {
      return { ok: false, error: 'invalid_nsfw' };
    }
    input.nsfw = body.nsfw;
    hasField = true;
  }

  if (body.rateLimitPerUser !== undefined) {
    if (
      typeof body.rateLimitPerUser !== 'number' ||
      !Number.isInteger(body.rateLimitPerUser) ||
      body.rateLimitPerUser < 0 ||
      body.rateLimitPerUser > MAX_RATE_LIMIT
    ) {
      return { ok: false, error: 'invalid_rate_limit' };
    }
    input.rateLimitPerUser = body.rateLimitPerUser;
    hasField = true;
  }

  if (body.bitrate !== undefined) {
    if (
      typeof body.bitrate !== 'number' ||
      !Number.isInteger(body.bitrate) ||
      body.bitrate < 8000 ||
      body.bitrate > MAX_BITRATE
    ) {
      return { ok: false, error: 'invalid_bitrate' };
    }
    input.bitrate = body.bitrate;
    hasField = true;
  }

  if (body.userLimit !== undefined) {
    if (
      typeof body.userLimit !== 'number' ||
      !Number.isInteger(body.userLimit) ||
      body.userLimit < 0 ||
      body.userLimit > MAX_USER_LIMIT
    ) {
      return { ok: false, error: 'invalid_user_limit' };
    }
    input.userLimit = body.userLimit;
    hasField = true;
  }

  if (body.position !== undefined) {
    if (typeof body.position !== 'number' || !Number.isInteger(body.position) || body.position < 0) {
      return { ok: false, error: 'invalid_position' };
    }
    input.position = body.position;
    hasField = true;
  }

  if (body.rtcRegion !== undefined) {
    if (body.rtcRegion !== null && typeof body.rtcRegion !== 'string') {
      return { ok: false, error: 'invalid_rtc_region' };
    }
    input.rtcRegion = body.rtcRegion;
    hasField = true;
  }

  if (body.reason !== undefined) {
    if (typeof body.reason !== 'string') {
      return { ok: false, error: 'invalid_reason' };
    }
    input.reason = body.reason;
  }

  if (!hasField) {
    return { ok: false, error: 'empty_update' };
  }

  return { ok: true, input };
}

/** Validate input and update a guild channel's properties. */
export async function updateChannel(
  channelId: string,
  body: UpdateChannelBody,
  context: AuthenticatedServiceContext,
): Promise<UpdateChannelResult> {
  if (!isSnowflake(channelId)) {
    recordAuthenticatedAdminOperation(context, {
      action: 'channel.update',
      category: 'channel',
      targetType: 'channel',
      targetId: channelId,
      success: false,
      errorMessage: 'invalid_channel_id',
      summary: 'チャンネル更新に失敗しました',
    });
    return { ok: false, status: 400, error: 'invalid_channel_id' };
  }

  const parsed = parseUpdateInput(body);
  if (!parsed.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'channel.update',
      category: 'channel',
      targetType: 'channel',
      targetId: channelId,
      success: false,
      errorMessage: parsed.error,
      summary: 'チャンネル更新に失敗しました',
      metadata: { body },
    });
    return { ok: false, status: 400, error: parsed.error };
  }

  const result = await updateGuildChannel(channelId, parsed.input);
  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'channel.update',
      category: 'channel',
      targetType: 'channel',
      targetId: channelId,
      success: false,
      errorMessage: result.error,
      summary: 'チャンネル更新に失敗しました',
      metadata: { input: parsed.input },
    });
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  invalidateChannelListCache();
  invalidateChannelDetailCache(channelId);
  recordAuthenticatedAdminOperation(context, {
    action: 'channel.update',
    category: 'channel',
    targetType: 'channel',
    targetId: channelId,
    success: true,
    summary: `チャンネル「${result.data.name}」を更新しました`,
    metadata: { input: parsed.input },
  });

  return { ok: true, data: result.data };
}
