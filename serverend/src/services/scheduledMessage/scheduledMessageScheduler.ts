import schedule from 'node-schedule';
import {
  getScheduledMessageList,
  markScheduledMessageResult,
} from '#server/stores/scheduledMessageStore.js';
import { dispatchScheduledMessage } from '#server/services/scheduledMessage/dispatchScheduledMessage.js';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('services/scheduledMessage/scheduler');

const JOB_PREFIX = 'scheduled-message:';

function jobName(id: string): string {
  return `${JOB_PREFIX}${id}`;
}

/** Cancel a node-schedule job for a scheduled message, if any. */
export function cancelScheduledMessageJob(id: string): void {
  const job = schedule.scheduledJobs[jobName(id)];
  if (job) {
    job.cancel();
  }
}

/** Schedule (or reschedule) a pending message for its scheduledAt time. */
export function scheduleScheduledMessageJob(id: string, scheduledAtIso: string): boolean {
  cancelScheduledMessageJob(id);
  const when = new Date(scheduledAtIso);
  if (Number.isNaN(when.getTime())) {
    logger.warn(`Invalid scheduledAt for ${id}: ${scheduledAtIso}`);
    return false;
  }
  if (when.getTime() <= Date.now()) {
    // Past due jobs are handled by miss-check / send-now; do not schedule in the past.
    return false;
  }

  schedule.scheduleJob(jobName(id), when, () => {
    void dispatchScheduledMessage(id).catch((error) => {
      logger.error(`Job for ${id} threw: ${String(error)}`);
    });
  });
  return true;
}

/**
 * On bot ready: mark overdue pending schedules as failed (missed while down),
 * then register jobs for remaining future pending schedules.
 */
export async function initScheduledMessageScheduler(): Promise<void> {
  const list = await getScheduledMessageList();
  const now = Date.now();
  let missed = 0;
  let scheduled = 0;

  for (const message of list) {
    if (message.success !== null) {
      continue;
    }

    const dueAt = new Date(message.scheduledAt).getTime();
    if (Number.isNaN(dueAt)) {
      await markScheduledMessageResult(message.id, {
        success: false,
        error: 'invalid_scheduled_at',
      });
      missed += 1;
      continue;
    }

    if (dueAt <= now) {
      await markScheduledMessageResult(message.id, {
        success: false,
        error: 'missed_while_offline',
      });
      missed += 1;
      logger.warn(
        `Marked scheduled message ${message.id} as failed (missed while offline; due ${message.scheduledAt})`,
      );
      continue;
    }

    if (scheduleScheduledMessageJob(message.id, message.scheduledAt)) {
      scheduled += 1;
    }
  }

  logger.info(
    `Scheduler initialized: ${scheduled} job(s) registered, ${missed} missed message(s) marked failed`,
  );
}
