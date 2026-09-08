import {
  createGuildThread,
  isCreatableThreadType,
  isThreadAutoArchiveDuration,
  type CreateGuildThreadError,
  type CreateGuildThreadInput,
  type GuildThreadDetail,
} from '#server/discord/createThread.js';
import { ChannelType } from 'discord.js';
import { invalidateChannelListCache } from '#server/services/discord/getChannelListService.js';
import { recordAuthenticatedAdminOperation } from '#server/services/operationLog/recordAdminOperation.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';

export type CreateThreadValidationError =
  | 'invalid_channel_id'
  | 'invalid_name'
  | 'invalid_type'
  | 'invalid_message'
  | 'invalid_auto_archive_duration'
  | 'invalid_rate_limit'
  | 'invalid_reason';

export type CreateThreadResult =
  | { ok: true; data: GuildThreadDetail }
  | {
      ok: false;
      status: number;
      error: CreateGuildThreadError | CreateThreadValidationError;
    };

const MAX_NAME_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_RATE_LIMIT = 21600;

function isSnowflake(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}

function errorStatus(error: CreateGuildThreadError): number {
  switch (error) {
    case 'bot_not_connected':
    case 'guild_not_configured':
      return 503;
    case 'channel_not_found':
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

export type CreateThreadBody = {
  name?: unknown;
  type?: unknown;
  message?: unknown;
  autoArchiveDuration?: unknown;
  rateLimitPerUser?: unknown;
  reason?: unknown;
};

function parseCreateInput(
  parentChannelId: string,
  body: CreateThreadBody,
):
  | { ok: true; input: CreateGuildThreadInput }
  | { ok: false; error: CreateThreadValidationError } {
  if (!isSnowflake(parentChannelId)) {
    return { ok: false, error: 'invalid_channel_id' };
  }

  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > MAX_NAME_LENGTH) {
    return { ok: false, error: 'invalid_name' };
  }

  const input: CreateGuildThreadInput = {
    parentChannelId,
    name: body.name.trim(),
  };

  if (body.type !== undefined) {
    if (typeof body.type !== 'number' || !Number.isInteger(body.type) || !isCreatableThreadType(body.type)) {
      return { ok: false, error: 'invalid_type' };
    }
    input.type = body.type;
  }

  if (body.message !== undefined) {
    if (typeof body.message !== 'string' || body.message.trim().length > MAX_MESSAGE_LENGTH) {
      return { ok: false, error: 'invalid_message' };
    }
    const trimmed = body.message.trim();
    if (trimmed.length > 0) {
      input.message = trimmed;
    }
  }

  if (body.autoArchiveDuration !== undefined) {
    if (
      typeof body.autoArchiveDuration !== 'number' ||
      !Number.isInteger(body.autoArchiveDuration) ||
      !isThreadAutoArchiveDuration(body.autoArchiveDuration)
    ) {
      return { ok: false, error: 'invalid_auto_archive_duration' };
    }
    input.autoArchiveDuration = body.autoArchiveDuration;
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

  if (body.reason !== undefined) {
    if (typeof body.reason !== 'string') {
      return { ok: false, error: 'invalid_reason' };
    }
    input.reason = body.reason;
  }

  return { ok: true, input };
}

/** Validate input and create a thread / forum post under a parent channel. */
export async function createThread(
  parentChannelId: string,
  body: CreateThreadBody,
  context: AuthenticatedServiceContext,
): Promise<CreateThreadResult> {
  const parsed = parseCreateInput(parentChannelId, body);
  if (!parsed.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'thread.create',
      category: 'channel',
      targetType: 'channel',
      targetId: parentChannelId,
      success: false,
      errorMessage: parsed.error,
      summary: 'スレッド作成に失敗しました',
      metadata: { body },
    });
    return { ok: false, status: 400, error: parsed.error };
  }

  const result = await createGuildThread(parsed.input);
  if (!result.ok) {
    recordAuthenticatedAdminOperation(context, {
      action: 'thread.create',
      category: 'channel',
      targetType: 'channel',
      targetId: parentChannelId,
      success: false,
      errorMessage: result.error,
      summary: 'スレッド作成に失敗しました',
      metadata: { input: parsed.input },
    });
    return { ok: false, status: errorStatus(result.error), error: result.error };
  }

  invalidateChannelListCache();
  const kind =
    result.data.type === ChannelType.PrivateThread ? 'プライベートスレッド' : 'スレッド';
  recordAuthenticatedAdminOperation(context, {
    action: 'thread.create',
    category: 'channel',
    targetType: 'channel',
    targetId: result.data.id,
    success: true,
    summary: `${kind}「${result.data.name}」を作成しました`,
    metadata: {
      parentId: result.data.parentId,
      categoryId: result.data.categoryId,
      type: result.data.type,
      input: parsed.input,
    },
  });

  return { ok: true, data: result.data };
}
