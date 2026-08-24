import { Hono } from 'hono';
import { getHealth } from '#server/services/utils/healthService.js';

const utils = new Hono();

utils.get('/health', (c) => c.json(getHealth()));

export default utils;
