import { Hono } from 'hono';
import { getHealth } from '#server/services/utils/healthService.js';
import { getVersion } from '#server/services/utils/versionService.js';

const utils = new Hono();

utils.get('/health', (c) => c.json(getHealth()));
utils.get('/version', (c) => c.json(getVersion()));
export default utils;
