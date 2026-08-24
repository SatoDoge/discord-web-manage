import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import { createApp } from '#server/api.js';
import { Logger } from '#server/utils/logger.js';
import { createDiscordClient } from '#server/discord.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const logger = new Logger('serverend');
dotenv.config({ path: path.join(rootDir, '.env') });

const port = Number(process.env.PORT ?? 3000);
const app = createApp();
createDiscordClient(); // DiscordBotを起動
serve({ fetch: app.fetch, port }, (info) => {
  logger.info(`listening on http://localhost:${info.port}`);
});
