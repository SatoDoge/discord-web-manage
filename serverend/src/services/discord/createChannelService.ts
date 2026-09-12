import {
  createGuildChannel,
  isCreatableChannelType,
  type CreateGuildChannelError,
  type CreateGuildChannelInput,
  type CreatableChannelType,
} from '#server/discord/createChannel.js';
import { ChannelType } from 'discord.js';
import type { GuildChannelDetail } from '#server/discord/getChannelDetail.js';
import { invalidateChannelListCache } from '#server/services/discord/getChannelListService.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type CreateChannelValidationError =
  | 'invalid_name'
  | 'invalid_type'
  | 'invalid_parent_id'
  | 'invalid_topic'
  | 'invalid_nsfw'
  | 'invalid_rate_limit'
  | 'invalid_bitrate'
  | 'invalid_user_limit'
  | 'invalid_position'
  | 'invalid_reason';

export type CreateChannelResult =
  | { ok: true; data: GuildChannelDetail }
  | {
      ok: false;
      status: number;
      error: CreateGuildChannelError | CreateChannelValidationError;
    };

const MAX_NAME_LENGTH = 100;
const MAX_TOPIC_LENGTH = 1024;
const MAX_RATE_LIMIT = 21600;
const MAX_BITRATE = 384000;
const MAX_USER_LIMIT = 99;

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function errorStatus(error: CreateGuildChannelError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'guild_not_found':
      return 404;
    case 'missing_permission':
      return 403;
    case 'create_failed':
      return 502;
    default:
      return 400;
  }
}

export type CreateChannelBody = {
  name?: unknown;
  type?: unknown;
  parentId?: unknown;
  topic?: unknown;
  nsfw?: unknown;
  rateLimitPerUser?: unknown;
  bitrate?: unknown;
  userLimit?: unknown;
  position?: unknown;
  reason?: unknown;
};

function parseCreateInput(
  body: CreateChannelBody,
):
  | { ok: true; input: CreateGuildChannelInput }
  | { ok: false; error: CreateChannelValidationError } {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > MAX_NAME_LENGTH) {
    return { ok: false, error: 'invalid_name' };
  }

  if (typeof body.type !== 'number' || !Number.isInteger(body.type) || !isCreatableChannelType(body.type)) {
    return { ok: false, error: 'invalid_type' };
  }
  const type = body.type as CreatableChannelType;

  const input: CreateGuildChannelInput = {
    name: body.name.trim(),
    type,
  };

  if (body.parentId !== undefined && body.parentId !== null) {
    if (typeof body.parentId !== 'string' || !isSnowflake(body.parentId)) {
      return { ok: false, error: 'invalid_parent_id' };
    }
    input.parentId = body.parentId;
  } else if (body.parentId === null) {
    input.parentId = null;
  }

  if (body.topic !== undefined) {
    if (body.topic !== null && typeof body.topic !== 'string') {
      return { ok: false, error: 'invalid_topic' };
    }
    if (typeof body.topic === 'string' && body.topic.length > MAX_TOPIC_LENGTH) {
      return { ok: false, error: 'invalid_topic' };
    }
    input.topic = body.topic;
  }

  if (body.nsfw !== undefined) {
    if (typeof body.nsfw !== 'boolean') {
      return { ok: false, error: 'invalid_nsfw' };
    }
    input.nsfw = body.nsfw;
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
  }

  if (body.position !== undefined) {
    if (typeof body.position !== 'number' || !Number.isInteger(body.position) || body.position < 0) {
      return { ok: false, error: 'invalid_position' };
    }
    input.position = body.position;
  }

  if (body.reason !== undefined) {
    if (typeof body.reason !== 'string') {
      return { ok: false, error: 'invalid_reason' };
    }
    input.reason = body.reason;
  }

  return { ok: true, input };
}

function typeLabel(type: CreatableChannelType): string {
  switch (type) {
    case ChannelType.GuildText:
      return 'テキスト';
    case ChannelType.GuildVoice:
      return 'ボイス';
    case ChannelType.GuildCategory:
      return 'カテゴリ';
    case ChannelType.GuildAnnouncement:
      return 'アナウンス';
    case ChannelType.GuildStageVoice:
      return 'ステージ';
    case ChannelType.GuildForum:
      return 'フォーラム';
    default:
      return 'チャンネル';
  }
}

/** Validate input and create a guild channel (optionally under a category). */
export async function createChannel(
  body: CreateChannelBody,
  context: AuthenticatedServiceContext,
): Promise<CreateChannelResult> {
  const parsed = parseCreateInput(body);
  if (!parsed.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'channel.create',
      category: 'channel',
      targetType: 'channel',
      success: false,
      errorMessage: parsed.error,
      summary: 'チャンネル作成に失敗しました',
      metadata: { body },
    });
    return { ok: false, status: 400, error: parsed.error };
  }

  const result = await createGuildChannel(parsed.input);
  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'channel.create',
      category: 'channel',
      targetType: 'channel',
      success: false,
      errorMessage: result.error,
      summary: 'チャンネル作成に失敗しました',
      metadata: { input: parsed.input },
    });
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  invalidateChannelListCache();
  recordAuthenticatedAdminOperation(context, {
    action: 'channel.create',
    category: 'channel',
    targetType: 'channel',
    targetId: result.data.id,
    success: true,
    summary: `${typeLabel(parsed.input.type)}チャンネル「${result.data.name}」を作成しました`,
    metadata: {
      type: result.data.type,
      parentId: result.data.parentId,
      input: parsed.input,
    },
  });

  return { ok: true, data: result.data };
}
