import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { fetchOperationLogList } from '#server/services/operationLog/getOperationLogListService.js';
import { fetchOperationLog } from '#server/services/operationLog/getOperationLogService.js';

const operationLog = new Hono<{ Variables: AuthVariables }>();

operationLog.use('*', requireAuth);

/** All operation logs (most recent first, max 500). */
operationLog.get('/', async (c) => {
  const logs = await fetchOperationLogList();
  return c.json({ logs });
});

/** Single operation log by id. */
operationLog.get('/:logId', async (c) => {
  const result = await fetchOperationLog(c.req.param('logId'));
  if (!result.ok) {
    const status: ContentfulStatusCode =
      result.error === 'invalid_log_id' ? 400 : 404;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.log);
});

export default operationLog;
