import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from '#server/routes/auth.js';
import dashboard from '#server/routes/dashboard.js';
import discord from '#server/routes/discord.js';
import filter from '#server/routes/filter.js';
import memberJoin from '#server/routes/memberJoin.js';
import message from '#server/routes/message.js';
import operationLog from '#server/routes/operationLog.js';
import user from '#server/routes/user.js';
import utils from '#server/routes/utils.js';
import { Logger } from '#server/utils/logger.js';
/**
 * HTTP API for the Vue frontend.
 * Routes live under src/routes; business logic under src/services.
 */
const logger = new Logger('API Routes');
const apiLogger = new Logger('API');


export function createApp() {
  logger.info('Creating Hono app');
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origin) => origin ?? '*',
      credentials: true,
    }),
  );
  app.use('*', async (c, next) => {
    apiLogger.info(`${c.req.method} ${c.req.path}`);
    await next();
  });
  app.route('/api/auth', auth);
  app.route('/api/dashboard', dashboard);
  app.route('/api/user', user);
  app.route('/api/discord', discord);
  app.route('/api/filter', filter);
  app.route('/api/message', message);
  app.route('/api/member-join', memberJoin);
  app.route('/api/operation-logs', operationLog);
  app.route('/api', utils);
  
  logger.info('App created');
  logger.info('Available routes:');   
  app.routes.forEach((route) => {
    logger.info(`${route.method} ${route.path}`);
  });
  return app;
}
