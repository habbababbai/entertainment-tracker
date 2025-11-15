import { type User } from "@prisma/client";
import { type FastifyInstance, type FastifyPluginAsync } from "fastify";

import { hashPassword, verifyPassword } from "../../lib/auth/password.js";
import {
    createResetTokenExpiration,
    generateResetToken,
    isResetTokenExpired,
} from "../../lib/auth/reset-token.js";
import { issueTokenPair, verifyRefreshToken } from "../../lib/auth/tokens.js";
import { type SerializedUser } from "../../lib/auth/types.js";
import {
    badRequest,
    conflict,
    notFound,
    unauthorized,
} from "../../lib/http-errors.js";

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

interface ForgotPasswordBody {
    email: string;
}

interface ResetPasswordBody {
    resetToken: string;
    newPassword: string;
}

interface DeleteAccountBody {
    password: string;
    email: string;
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

    app.post(
        "/auth/forgot-password",
        {
            schema: {
                body: {
                    type: "object",
                    properties: {
                        email: { type: "string", format: "email" },
                    },
                    required: ["email"],
                    additionalProperties: false,
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            message: { type: "string" },
                            resetToken: { type: "string" },
                        },
                        required: ["message"],
                    },
                    404: errorResponseSchema,
                },
            },
        },
        async (request, reply) => {
            const { email } = request.body as ForgotPasswordBody;

            const user = await app.prisma.user.findUnique({
                where: { email },
            });

            if (user) {
                const resetToken = generateResetToken();
                const expiresAt = createResetTokenExpiration();

                await app.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        passwordResetToken: resetToken,
                        passwordResetTokenExpiresAt: expiresAt,
                    },
                });

                return reply.send({
                    message:
                        "If an account with that email exists, a password reset token has been generated.",
                    resetToken,
                });
            }

            return reply.send({
                message:
                    "If an account with that email exists, a password reset token has been generated.",
            });
        }
    );

    app.post(
        "/auth/reset-password",
        {
            schema: {
                body: {
                    type: "object",
                    properties: {
                        resetToken: { type: "string", minLength: 1 },
                        newPassword: {
                            type: "string",
                            minLength: 8,
                            description:
                                "Password must be at least 8 characters long",
                        },
                    },
                    required: ["resetToken", "newPassword"],
                    additionalProperties: false,
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            message: { type: "string" },
                        },
                        required: ["success", "message"],
                    },
                    400: errorResponseSchema,
                    404: errorResponseSchema,
                },
            },
        },
        async (request, reply) => {
            const { resetToken, newPassword } =
                request.body as ResetPasswordBody;

            const user = await app.prisma.user.findFirst({
                where: {
                    passwordResetToken: resetToken,
                },
            });

            if (!user) {
                throw notFound("Invalid or expired reset token");
            }

            if (
                !user.passwordResetTokenExpiresAt ||
                isResetTokenExpired(user.passwordResetTokenExpiresAt)
            ) {
                await app.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        passwordResetToken: null,
                        passwordResetTokenExpiresAt: null,
                    },
                });
                throw badRequest("Reset token has expired");
            }

            const newPasswordHash = await hashPassword(newPassword);

            await app.prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash: newPasswordHash,
                    passwordResetToken: null,
                    passwordResetTokenExpiresAt: null,
                    tokenVersion: {
                        increment: 1,
                    },
                },
            });

            return reply.send({
                success: true,
                message: "Password has been reset successfully",
            });
        }
    );

    app.delete(
        "/auth/account",
        {
            onRequest: [app.authenticate],
            schema: {
                headers: {
                    type: "object",
                    properties: {
                        authorization: {
                            type: "string",
                            pattern: "^Bearer .+",
                        },
                    },
                    required: ["authorization"],
                },
                body: {
                    type: "object",
                    properties: {
                        password: { type: "string", minLength: 1 },
                        email: { type: "string", format: "email" },
                    },
                    required: ["password", "email"],
                    additionalProperties: false,
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            message: { type: "string" },
                        },
                        required: ["success", "message"],
                    },
                    401: errorResponseSchema,
                },
            },
        },
        async (request, reply) => {
            const { password, email } = request.body as DeleteAccountBody;

            const user = await app.prisma.user.findUnique({
                where: { id: request.user.id },
            });

            if (!user) {
                throw unauthorized("User not found");
            }

            if (user.tokenVersion !== request.user.tokenVersion) {
                throw unauthorized("Invalid or expired access token");
            }

            const passwordValid = await verifyPassword(
                password,
                user.passwordHash
            );

            if (!passwordValid) {
                throw unauthorized("Invalid password");
            }

            if (user.email !== email) {
                throw unauthorized("Email does not match");
            }

            await app.prisma.user.delete({
                where: { id: user.id },
            });

            return reply.send({
                success: true,
                message: "Account has been deleted successfully",
            });
        }
    );
};

/**
 * Builds an authentication response object containing user data and tokens.
 * Serializes the user object before including it in the response.
 *
 * @param user - The user object from the database
 * @param tokens - Object containing access and refresh tokens
 * @returns An AuthResponse object with serialized user and tokens
 */
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

/**
 * Serializes a User database object to a safe format for API responses.
 * Converts Date objects to ISO strings and excludes sensitive fields like passwordHash.
 *
 * @param user - The User object from Prisma
 * @returns A serialized user object safe for API responses
 */
function serializeUser(user: User): SerializedUser {
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    };
}

/**
 * Checks if an error is a Prisma unique constraint violation error.
 * Prisma throws errors with code "P2002" when a unique constraint is violated.
 *
 * @param error - The error object to check
 * @returns `true` if the error is a unique constraint violation, `false` otherwise
 */
function isUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "P2002"
    );
}

/**
 * Retrieves and validates a user for a refresh token.
 * Verifies the refresh token, then checks that the user exists and token version matches.
 * Throws an unauthorized error if validation fails.
 *
 * @param app - The Fastify instance (for database access)
 * @param refreshToken - The refresh token to validate
 * @returns A promise that resolves to the authenticated User object
 * @throws {HttpError} If the token is invalid, expired, or user/token version mismatch
 */
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
