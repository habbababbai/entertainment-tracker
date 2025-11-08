import { buildApp } from "./app.js";
import { env } from "./env.js";

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
