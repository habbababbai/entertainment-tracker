import { FastifyInstance, FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (
    app: FastifyInstance
) => {
    app.get(
        "/health",
        {
            schema: {
                response: {
                    200: {
                        type: "object",
                        properties: {
                            status: { type: "string" },
                            timestamp: { type: "string" },
                        },
                    },
                },
            },
        },
        async () => ({
            status: "ok",
            timestamp: new Date().toISOString(),
        })
    );
};
