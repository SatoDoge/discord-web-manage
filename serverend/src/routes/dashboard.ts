import { Hono } from 'hono';
import { requireAuth, type AuthVariables } from '#server/authMiddleware.js';
import { fetchDashboardSummary } from '#server/services/dashboard/getDashboardSummaryService.js';

const dashboard = new Hono<{ Variables: AuthVariables }>();

dashboard.use('*', requireAuth);

/** Aggregated metrics for the dashboard widgets. */
dashboard.get('/summary', async (c) => {
  const summary = await fetchDashboardSummary();
  return c.json(summary);
});

export default dashboard;
