import { FastifyInstance } from "fastify";

import { healthRoutes } from "./v1/health.js";
import { mediaRoutes } from "./v1/media.js";
import { authRoutes } from "./v1/auth.js";
import { watchlistRoutes } from "./v1/watchlist.js";

/**
 * Registers all API route plugins with the Fastify application.
 * All routes are prefixed with `/api/v1`.
 *
 * @param app - The Fastify instance to register routes on
 *
 * @example
 * ```ts
 * const app = fastify();
 * registerRoutes(app);
 * // Routes are now available at /api/v1/health, /api/v1/media, etc.
 * ```
 */
export function registerRoutes(app: FastifyInstance): void {
    app.register(healthRoutes, { prefix: "/api/v1" });
    app.register(mediaRoutes, { prefix: "/api/v1" });
    app.register(authRoutes, { prefix: "/api/v1" });
    app.register(watchlistRoutes, { prefix: "/api/v1" });
}
