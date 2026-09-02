import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  memberFilterDefaultSettings,
  type JoinDelayFilterSettings,
  type MemberFilterSettings,
  type MemberProfileModerationFilterSettings,
  type NameFilterSettings,
} from '#server/types/memberFilterSettings.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/memberFilterSettings.json',
);

const enqueue = createWriteQueue();

function cloneDefaultSettings(): MemberFilterSettings {
  return structuredClone(memberFilterDefaultSettings);
}

async function readFromDisk(): Promise<MemberFilterSettings> {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      const defaults = cloneDefaultSettings();
      await writeToDisk(defaults);
      return defaults;
    }
    return JSON.parse(trimmed) as MemberFilterSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const defaults = cloneDefaultSettings();
      await writeToDisk(defaults);
      return defaults;
    }
    throw error;
  }
}

async function writeToDisk(settings: MemberFilterSettings): Promise<void> {
  await writeFile(DATA_PATH, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

/** Read all member filter settings. */
export function getMemberFilterSettings(): Promise<MemberFilterSettings> {
  return enqueue(() => readFromDisk());
}

/** Replace all member filter settings. */
export function setMemberFilterSettings(
  settings: MemberFilterSettings,
): Promise<MemberFilterSettings> {
  return enqueue(async () => {
    await writeToDisk(settings);
    return settings;
  });
}

/** Read name filter settings. */
export async function getNameFilterSettings(): Promise<NameFilterSettings> {
  const settings = await getMemberFilterSettings();
  return settings.nameFilterSettings;
}

/** Replace name filter settings. */
export function updateNameFilterSettings(
  nameFilterSettings: NameFilterSettings,
): Promise<NameFilterSettings> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next: MemberFilterSettings = {
      ...current,
      nameFilterSettings,
    };
    await writeToDisk(next);
    return nameFilterSettings;
  });
}

/** Read join delay filter settings. */
export async function getJoinDelayFilterSettings(): Promise<JoinDelayFilterSettings> {
  const settings = await getMemberFilterSettings();
  return settings.joinDelayFilterSettings;
}

/** Replace join delay filter settings. */
export function updateJoinDelayFilterSettings(
  joinDelayFilterSettings: JoinDelayFilterSettings,
): Promise<JoinDelayFilterSettings> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next: MemberFilterSettings = {
      ...current,
      joinDelayFilterSettings,
    };
    await writeToDisk(next);
    return joinDelayFilterSettings;
  });
}

/** Read member profile moderation filter settings. */
export async function getMemberProfileModerationFilterSettings(): Promise<MemberProfileModerationFilterSettings> {
  const settings = await getMemberFilterSettings();
  return settings.memberProfileModerationFilterSettings;
}

/** Replace member profile moderation filter settings. */
export function updateMemberProfileModerationFilterSettings(
  memberProfileModerationFilterSettings: MemberProfileModerationFilterSettings,
): Promise<MemberProfileModerationFilterSettings> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next: MemberFilterSettings = {
      ...current,
      memberProfileModerationFilterSettings,
    };
    await writeToDisk(next);
    return memberProfileModerationFilterSettings;
  });
}

/**
 * Atomically read → transform → write under the same queue slot.
 * Prefer this for mutations that depend on current contents.
 */
export function updateMemberFilterSettings(
  updater: (
    settings: MemberFilterSettings,
  ) => MemberFilterSettings | Promise<MemberFilterSettings>,
): Promise<MemberFilterSettings> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next = await updater(current);
    await writeToDisk(next);
    return next;
  });
}
