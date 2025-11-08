import { FastifyInstance } from 'fastify';

import { healthRoutes } from './v1/health.js';
import { mediaRoutes } from './v1/media.js';

export function registerRoutes(app: FastifyInstance): void {
  app.register(healthRoutes, { prefix: '/api/v1' });
  app.register(mediaRoutes, { prefix: '/api/v1' });
}

