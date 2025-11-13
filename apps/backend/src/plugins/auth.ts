import fp from "fastify-plugin";
import { type FastifyReply, type FastifyRequest } from "fastify";

import { verifyAccessToken } from "../lib/auth/tokens.js";
import { type AuthenticatedUser } from "../lib/auth/types.js";
import { unauthorized } from "../lib/http-errors.js";

declare module "fastify" {
    interface FastifyInstance {
        authenticate: (
            request: FastifyRequest,
            reply: FastifyReply
        ) => Promise<void>;
    }

    interface FastifyRequest {
        user: AuthenticatedUser;
    }
}

export const authPlugin = fp(async (app) => {
    app.decorate("authenticate", async (request: FastifyRequest) => {
        const authorization = request.headers.authorization;
        if (!authorization?.startsWith("Bearer ")) {
            throw unauthorized("Missing or invalid Authorization header");
        }

        const token = authorization.slice("Bearer ".length).trim();

        try {
            const payload = verifyAccessToken(token);
            request.user = {
                id: payload.sub,
                tokenVersion: payload.tokenVersion,
            };
        } catch (error) {
            app.log.debug({ err: error }, "Access token verification failed");
            throw unauthorized("Invalid or expired access token");
        }
    });
});
