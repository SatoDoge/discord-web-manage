import { getMessageList } from '#server/stores/messageDataStore.js';
import type { StoredGuildMessageList } from '#server/types/messageData.js';

export async function fetchStoredMessageList(): Promise<StoredGuildMessageList> {
  return getMessageList();
}
