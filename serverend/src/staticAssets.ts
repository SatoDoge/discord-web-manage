import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';
import { Logger } from '#server/utils/logger.js';

const logger = new Logger('staticAssets');

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(moduleDir, '../../frontend/dist');

/** True when running compiled output (node dist/*.js), false when tsx runs src/*.ts in dev. */
function isRunningCompiledOutput(): boolean {
  return moduleDir.split(path.sep).includes('dist');
}

function shouldServeStatic(): boolean {
  const override = process.env.SERVE_STATIC?.trim().toLowerCase();
  if (override === 'false') {
    return false;
  }
  if (override === 'true') {
    return true;
  }
  return isRunningCompiledOutput();
}

/** Serve the built Vue app in production (node dist). Disabled during tsx dev. */
export function registerStaticAssets(app: Hono): void {
  if (!shouldServeStatic()) {
    logger.info('Static serving disabled');
    return;
  }

  const indexPath = path.join(frontendDist, 'index.html');
  if (!existsSync(indexPath)) {
    logger.warn(
      `Static serving enabled but ${indexPath} was not found. Run "npm run build -w frontend" first.`,
    );
    return;
  }

  logger.info(`Serving frontend from ${frontendDist}`);

  app.use('*', serveStatic({ root: frontendDist }));
  app.get('*', serveStatic({ path: './index.html', root: frontendDist }));
}
