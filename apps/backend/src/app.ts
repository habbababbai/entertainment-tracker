
import fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";

import { registerRoutes } from "./routes/index.js";

type BuildAppOptions = FastifyServerOptions;

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

    registerRoutes(app);

    return app;
}
