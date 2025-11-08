import { FastifyInstance } from 'fastify';

import { healthRoutes } from './v1/health.js';

export function registerRoutes(app: FastifyInstance): void {
  app.register(healthRoutes, { prefix: '/api/v1' });
}

