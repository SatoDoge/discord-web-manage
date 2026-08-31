import type { MeasuredMessage, StoredGuildMessage } from '#server/types/messageData.js';

export function createMeasuredEntry(
  operationUserId: string,
  entry: Omit<MeasuredMessage, 'operationUserId' | 'measuredAt'>,
): MeasuredMessage {
  return {
    ...entry,
    operationUserId,
    measuredAt: new Date().toISOString(),
  };
}

export function emptyMeasuredDetail(): Omit<
  MeasuredMessage,
  'command' | 'operationUserId' | 'measuredAt'
> {
  return {
    banDetail: null,
    kickDetail: null,
    roleDetail: null,
    deleteDetail: null,
  };
}

export function appendMeasuredMessage(
  stored: StoredGuildMessage,
  entry: MeasuredMessage,
): void {
  const current = stored.measuredMessage ?? [];
  stored.measuredMessage = [...current, entry];
  stored.isMeasured = true;
}
