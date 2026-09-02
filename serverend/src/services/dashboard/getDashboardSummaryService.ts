import { fetchOnlineMemberList } from '#server/services/discord/getOnlineMember.js';
import { fetchMemberList } from '#server/services/discord/getMemberListService.js';
import { fetchOperationLogList } from '#server/services/operationLog/getOperationLogListService.js';
import { fetchStoredMemberJoinEventList } from '#server/services/memberJoin/getMemberJoinEventListService.js';
import { fetchStoredMessageList } from '#server/services/message/getMessageListService.js';
import type {
  DashboardActivityItem,
  DashboardJoinTrendPoint,
  DashboardSummary,
} from '#server/types/dashboard.js';
import type { StoredMemberJoinEvent } from '#server/types/memberJoinData.js';
import type { StoredGuildMessage } from '#server/types/messageData.js';

const JOIN_TREND_DAYS = 14;
const RECENT_ACTIVITY_LIMIT = 10;

function toUtcDateKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isOnOrAfterUtcDay(iso: string, dayStart: Date): boolean {
  return new Date(iso) >= dayStart;
}

function buildJoinTrendDates(days: number): string[] {
  const today = startOfUtcDay(new Date());
  const dates: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    dates.push(toUtcDateKey(date));
  }

  return dates;
}

function buildJoinTrend(events: StoredMemberJoinEvent[]): DashboardJoinTrendPoint[] {
  const dates = buildJoinTrendDates(JOIN_TREND_DAYS);
  const counts = new Map<string, { joins: number; filteredJoins: number }>();

  for (const date of dates) {
    counts.set(date, { joins: 0, filteredJoins: 0 });
  }

  const oldestDate = dates[0];
  const oldestStart = startOfUtcDay(new Date(`${oldestDate}T00:00:00.000Z`));

  for (const event of events) {
    if (!isOnOrAfterUtcDay(event.joinedAt, oldestStart)) {
      continue;
    }

    const dateKey = toUtcDateKey(event.joinedAt);
    const bucket = counts.get(dateKey);
    if (!bucket) {
      continue;
    }

    bucket.joins += 1;
    if (event.isFiltered) {
      bucket.filteredJoins += 1;
    }
  }

  return dates.map((date) => ({
    date,
    joins: counts.get(date)?.joins ?? 0,
    filteredJoins: counts.get(date)?.filteredJoins ?? 0,
  }));
}

function countTodayJoins(events: StoredMemberJoinEvent[]): number {
  const todayKey = toUtcDateKey(new Date());
  return events.filter((event) => toUtcDateKey(event.joinedAt) === todayKey).length;
}

function buildMessageFilterSummary(messages: StoredGuildMessage[]) {
  const todayKey = toUtcDateKey(new Date());
  const weekStart = startOfUtcDay(new Date());
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

  let todayFiltered = 0;
  let weekFiltered = 0;
  let pending = 0;
  let word = 0;
  let dupli = 0;
  let moderation = 0;

  for (const message of messages) {
    if (!message.isFiltered) {
      continue;
    }

    const detectedAt = message.firstSeenAt;
    if (toUtcDateKey(detectedAt) === todayKey) {
      todayFiltered += 1;
    }
    if (isOnOrAfterUtcDay(detectedAt, weekStart)) {
      weekFiltered += 1;
    }
    if (!message.isMeasured) {
      pending += 1;
    }
    if (message.wordFilter?.isFiltered) {
      word += 1;
    }
    if (message.dupliFilter?.isFiltered) {
      dupli += 1;
    }
    if (message.moderationFilter?.isFiltered) {
      moderation += 1;
    }
  }

  return {
    todayFiltered,
    weekFiltered,
    pending,
    byType: { word, dupli, moderation },
  };
}

function buildMemberJoinFilterSummary(events: StoredMemberJoinEvent[]) {
  const todayKey = toUtcDateKey(new Date());
  const weekStart = startOfUtcDay(new Date());
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

  let todayFiltered = 0;
  let weekFiltered = 0;
  let pending = 0;
  let name = 0;
  let joinDelay = 0;
  let profileModeration = 0;

  for (const event of events) {
    if (!event.isFiltered) {
      continue;
    }

    const detectedAt = event.firstSeenAt;
    if (toUtcDateKey(detectedAt) === todayKey) {
      todayFiltered += 1;
    }
    if (isOnOrAfterUtcDay(detectedAt, weekStart)) {
      weekFiltered += 1;
    }
    if (!event.isMeasured) {
      pending += 1;
    }
    if (event.nameFilter?.isFiltered) {
      name += 1;
    }
    if (event.joinDelayFilter?.isFiltered) {
      joinDelay += 1;
    }
    if (event.memberProfileModerationFilter?.isFiltered) {
      profileModeration += 1;
    }
  }

  return {
    todayFiltered,
    weekFiltered,
    pending,
    byType: { name, joinDelay, profileModeration },
  };
}

/** Aggregate dashboard metrics from local stores. */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const [members, onlineMembers, messages, joinEvents, operationLogs] = await Promise.all([
    fetchMemberList(),
    fetchOnlineMemberList(),
    fetchStoredMessageList(),
    fetchStoredMemberJoinEventList(),
    fetchOperationLogList(),
  ]);

  const recentActivity: DashboardActivityItem[] = [];

  for (const log of operationLogs) {
    recentActivity.push({
      id: `log:${log.logId}`,
      type: 'operation_log',
      occurredAt: log.occurredAt,
      title: log.action,
      summary: log.summary,
      success: log.success,
      route: '/setting/operation-logs',
    });
  }

  for (const message of messages) {
    if (!message.isFiltered) {
      continue;
    }

    recentActivity.push({
      id: `message:${message.messageId}`,
      type: 'message_filter',
      occurredAt: message.firstSeenAt,
      title: message.author.displayName ?? message.author.username,
      summary: message.cleanContent || message.content || message.messageId,
      route: '/filter/messages',
    });
  }

  for (const event of joinEvents) {
    if (!event.isFiltered) {
      continue;
    }

    recentActivity.push({
      id: `join:${event.joinEventId}`,
      type: 'member_join_filter',
      occurredAt: event.firstSeenAt,
      title: event.displayName || event.username,
      summary: event.displayName || event.username,
      route: '/filter/member/joins',
    });
  }

  recentActivity.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return {
    kpi: {
      totalMembers: members.filter((member) => !member.bot).length,
      onlineMembers: onlineMembers.filter((member) => !member.bot).length,
      todayJoins: countTodayJoins(joinEvents),
    },
    joinTrend: buildJoinTrend(joinEvents),
    filterSummary: {
      message: buildMessageFilterSummary(messages),
      memberJoin: buildMemberJoinFilterSummary(joinEvents),
    },
    recentActivity: recentActivity.slice(0, RECENT_ACTIVITY_LIMIT),
  };
}
