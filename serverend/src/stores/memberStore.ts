import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  StoredGuildMember,
  StoredGuildMemberList,
  StoredGuildMemberWithoutPresence,
  StoredPresence,
} from '#server/types/member.js';
import { createWriteQueue } from '#server/utils/writeQueue.js';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/memberList.json',
);

const enqueue = createWriteQueue();

async function readFromDisk(): Promise<StoredGuildMemberList> {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed) as StoredGuildMemberList;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeToDisk([]);
      return [];
    }
    throw error;
  }
}

async function writeToDisk(list: StoredGuildMemberList): Promise<void> {
  await writeFile(DATA_PATH, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

function findIndexOrThrow(list: StoredGuildMemberList, id: string): number {
  const index = list.findIndex((member) => member.id === id);
  if (index === -1) {
    throw new Error(`Member not found: ${id}`);
  }
  return index;
}

/** Read all members (queued so it never interleaves with a write). */
export function getMemberList(): Promise<StoredGuildMemberList> {
  return enqueue(() => readFromDisk());
}

/** Read a single member by id. */
export function getMember(id: string): Promise<StoredGuildMember | undefined> {
  return enqueue(async () => {
    const list = await readFromDisk();
    return list.find((member) => member.id === id);
  });
}

/** Append a member. Throws if the id already exists. */
export function addMember(member: StoredGuildMember): Promise<StoredGuildMember> {
  return enqueue(async () => {
    const list = await readFromDisk();
    if (list.some((existing) => existing.id === member.id)) {
      throw new Error(`Member already exists: ${member.id}`);
    }
    await writeToDisk([...list, member]);
    return member;
  });
}

/** Remove a member by id. Returns true if removed, false if not found. */
export function removeMember(id: string): Promise<boolean> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const next = list.filter((member) => member.id !== id);
    if (next.length === list.length) {
      return false;
    }
    await writeToDisk(next);
    return true;
  });
}

/**
 * Replace the entire member record, including presence.
 * Throws if the member does not exist.
 */
export function updateMember(member: StoredGuildMember): Promise<StoredGuildMember> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const index = findIndexOrThrow(list, member.id);
    const next = [...list];
    next[index] = member;
    await writeToDisk(next);
    return member;
  });
}

/**
 * Update all fields except presence (existing presence is preserved).
 * Throws if the member does not exist.
 */
export function updateMemberWithoutPresence(
  member: StoredGuildMemberWithoutPresence,
): Promise<StoredGuildMember> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const index = findIndexOrThrow(list, member.id);
    const updated: StoredGuildMember = {
      ...member,
      presence: list[index]!.presence,
    };
    const next = [...list];
    next[index] = updated;
    await writeToDisk(next);
    return updated;
  });
}

/**
 * Update presence only. Throws if the member does not exist.
 */
export function updateMemberPresence(
  id: string,
  presence: StoredPresence | null,
): Promise<StoredGuildMember> {
  return enqueue(async () => {
    const list = await readFromDisk();
    const index = findIndexOrThrow(list, id);
    const updated: StoredGuildMember = {
      ...list[index]!,
      presence,
    };
    const next = [...list];
    next[index] = updated;
    await writeToDisk(next);
    return updated;
  });
}

/**
 * Atomically read → transform → write under the same queue slot.
 * Prefer this for mutations that depend on current contents.
 */
export function updateMemberList(
  updater: (
    list: StoredGuildMemberList,
  ) => StoredGuildMemberList | Promise<StoredGuildMemberList>,
): Promise<StoredGuildMemberList> {
  return enqueue(async () => {
    const current = await readFromDisk();
    const next = await updater(current);
    await writeToDisk(next);
    return next;
  });
}
