import { getBotPostedMessageList } from '#server/stores/botPostedMessageStore.js';
import type { BotPostedMessageList } from '#server/types/botPostedMessage.js';

/** Return bot-posted messages with the most recent entries first. */
export async function fetchBotPostedMessageList(): Promise<BotPostedMessageList> {
  const list = await getBotPostedMessageList();
  return [...list].reverse();
}
