import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('staticAssets');

const frontendDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../frontend/dist',
);

/** Serve the built Vue app when SERVE_STATIC=true (Docker / single-port production). */
export function registerStaticAssets(app: Hono): void {
  if (process.env.SERVE_STATIC !== 'true') {
    return;
  }

  logger.info(`Serving frontend from ${frontendDist}`);

  app.use('*', serveStatic({ root: frontendDist }));
  app.get('*', serveStatic({ path: './index.html', root: frontendDist }));
}
