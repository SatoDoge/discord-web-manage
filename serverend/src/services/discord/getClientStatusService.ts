import { getClientStatus } from '#server/discord/getClientStatus.js';
import type { ClientStatus } from '#server/discord/getClientStatus.js';

/** Return the current Discord bot client status. */
export function fetchClientStatus(): ClientStatus {
  return getClientStatus();
}
