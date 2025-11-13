import { type User } from "@prisma/client";
import {
    type FastifyInstance,
    type FastifyPluginAsync,
} from "fastify";

import { hashPassword, verifyPassword } from "../../lib/auth/password.js";
import { issueTokenPair, verifyRefreshToken } from "../../lib/auth/tokens.js";
import { type SerializedUser } from "../../lib/auth/types.js";
import { conflict, unauthorized } from "../../lib/http-errors.js";

const authResponseSchema = {
    type: "object",
    properties: {
        user: {
            type: "object",
            properties: {
                id: { type: "string" },
                email: { type: "string", format: "email" },
                username: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
            },
            required: ["id", "email", "username", "createdAt", "updatedAt"],
        },
        accessToken: { type: "string" },
        refreshToken: { type: "string" },
    },
    required: ["user", "accessToken", "refreshToken"],
} as const;

const errorResponseSchema = {
    type: "object",
    properties: {
        statusCode: { type: "integer" },
        error: { type: "string" },
        message: { type: "string" },
    },
    required: ["statusCode", "error", "message"],
} as const;

const tokenBodySchema = {
    type: "object",
    properties: {
        refreshToken: {
            type: "string",
            minLength: 1,
        },
    },
    required: ["refreshToken"],
    additionalProperties: false,
} as const;

interface RegisterBody {
    email: string;
    password: string;
    username: string;
}

interface LoginBody {
    email: string;
    password: string;
}

interface TokenBody {
    refreshToken: string;
}

interface AuthResponse {
    user: SerializedUser;
    accessToken: string;
    refreshToken: string;
}

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.post(
        "/auth/register",
        {
            schema: {
                body: {
                    type: "object",
                    properties: {
                        email: { type: "string", format: "email" },
                        password: {
                            type: "string",
                            minLength: 8,
                            description:
                                "Password must be at least 8 characters long",
                        },
                        username: {
                            type: "string",
                            minLength: 3,
                            maxLength: 32,
                        },
                    },
                    required: ["email", "password", "username"],
                    additionalProperties: false,
                },
                response: {
                    201: authResponseSchema,
                    409: errorResponseSchema,
                },
            },
        },
        async (request, reply) => {
            const { email, password, username } = request.body as RegisterBody;

            const passwordHash = await hashPassword(password);

            try {
                const user = await app.prisma.user.create({
                    data: {
                        email,
                        username,
                        passwordHash,
                    },
                });

                const tokens = issueTokenPair({
                    id: user.id,
                    tokenVersion: user.tokenVersion,
                });

                reply.code(201);
                return buildAuthResponse(user, tokens);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    throw conflict("Email or username is already in use");
                }

                throw error;
            }
        }
    );

    app.post(
        "/auth/login",
        {
            schema: {
                body: {
                    type: "object",
                    properties: {
                        email: { type: "string", format: "email" },
                        password: { type: "string", minLength: 8 },
                    },
                    required: ["email", "password"],
                    additionalProperties: false,
                },
                response: {
                    200: authResponseSchema,
                    401: errorResponseSchema,
                },
            },
        },
        async (request) => {
            const { email, password } = request.body as LoginBody;

            const user = await app.prisma.user.findUnique({
                where: { email },
            });

            if (!user) {
                throw unauthorized("Invalid credentials");
            }

            const passwordValid = await verifyPassword(
                password,
                user.passwordHash
            );

            if (!passwordValid) {
                throw unauthorized("Invalid credentials");
            }

            const tokens = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            return buildAuthResponse(user, tokens);
        }
    );

    app.post(
        "/auth/refresh",
        {
            schema: {
                body: tokenBodySchema,
                response: {
                    200: authResponseSchema,
                    401: errorResponseSchema,
                },
            },
        },
        async (request) => {
            const { refreshToken } = request.body as TokenBody;
            const user = await getUserForRefreshToken(app, refreshToken);
            const tokens = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            return buildAuthResponse(user, tokens);
        }
    );

    app.post(
        "/auth/logout",
        {
            schema: {
                body: tokenBodySchema,
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                        },
                        required: ["success"],
                    },
                    401: errorResponseSchema,
                },
            },
        },
        async (request, reply) => {
            const { refreshToken } = request.body as TokenBody;

            const user = await getUserForRefreshToken(app, refreshToken);

            await app.prisma.user.update({
                where: { id: user.id },
                data: {
                    tokenVersion: {
                        increment: 1,
                    },
                },
            });

            return reply.send({ success: true });
        }
    );
};

function buildAuthResponse(
    user: User,
    tokens: { accessToken: string; refreshToken: string }
): AuthResponse {
    return {
        user: serializeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
    };
}

function serializeUser(user: User): SerializedUser {
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    };
}

function isUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "P2002"
    );
}

async function getUserForRefreshToken(
    app: FastifyInstance,
    refreshToken: string
): Promise<User> {
    let payload;
    try {
        payload = verifyRefreshToken(refreshToken);
    } catch {
        throw unauthorized("Invalid or expired refresh token");
    }

    const user = await app.prisma.user.findUnique({
        where: { id: payload.sub },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion) {
        throw unauthorized("Invalid or expired refresh token");
    }

    return user;
}

