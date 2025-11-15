import { buildApp } from "./app.js";
import { env } from "./env.js";

/**
 * Bootstraps the application by building the Fastify app and starting the server.
 * Listens on the port and host specified in environment variables.
 * Exits the process with code 1 if the server fails to start.
 *
 * @throws Exits the process if server startup fails
 */
async function bootstrap(): Promise<void> {
    const app = buildApp();

    try {
        await app.listen({
            port: env.PORT,
            host: "0.0.0.0",
        });

        app.log.info(`Server listening on port ${env.PORT}`);
    } catch (error) {
        app.log.error(error, "Failed to start server");
        process.exit(1);
    }
}

void bootstrap();
