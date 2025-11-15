import fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";

import { registerRoutes } from "./routes/index.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { authPlugin } from "./plugins/auth.js";

type BuildAppOptions = FastifyServerOptions;

/**
 * Builds and configures a Fastify application instance.
 * Sets up CORS, Helmet security headers, Prisma database connection, and authentication plugin.
 * Registers all API routes under the `/api/v1` prefix.
 *
 * @param options - Optional Fastify server configuration options
 * @returns A configured Fastify instance ready to be started
 *
 * @example
 * ```ts
 * const app = buildApp({ logger: true });
 * await app.listen({ port: 3000 });
 * ```
 */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
    const app = fastify({
        logger: true,
        ...options,
    });

    app.register(fastifyCors, {
        origin: true,
        credentials: true,
    });

    app.register(fastifyHelmet, {
        global: true,
    });

    app.register(prismaPlugin);
    app.register(authPlugin);

    registerRoutes(app);

    return app;
}
