import type { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hashPasswordMock, verifyPasswordMock } = vi.hoisted(() => ({
    hashPasswordMock: vi.fn(async () => "hashed-password"),
    verifyPasswordMock: vi.fn(
        async (password: string, hash: string) =>
            hash === "hashed-password" && password === "Password123!"
    ),
}));

const {
    generateResetTokenMock,
    isResetTokenExpiredMock,
    createResetTokenExpirationMock,
} = vi.hoisted(() => ({
    generateResetTokenMock: vi.fn(() => "test-reset-token-123"),
    isResetTokenExpiredMock: vi.fn((expiresAt: Date | null) => {
        if (!expiresAt) return true;
        return new Date() > expiresAt;
    }),
    createResetTokenExpirationMock: vi.fn((hoursFromNow = 1) => {
        const expiration = new Date();
        expiration.setHours(expiration.getHours() + hoursFromNow);
        return expiration;
    }),
}));

vi.mock("../src/lib/auth/password.js", () => ({
    hashPassword: hashPasswordMock,
    verifyPassword: verifyPasswordMock,
    __esModule: true,
}));

vi.mock("../src/lib/auth/reset-token.js", () => ({
    generateResetToken: generateResetTokenMock,
    isResetTokenExpired: isResetTokenExpiredMock,
    createResetTokenExpiration: createResetTokenExpirationMock,
    __esModule: true,
}));

import { hashPassword } from "../src/lib/auth/password.js";
import { authRoutes } from "../src/routes/v1/auth.js";
import { unauthorized } from "../src/lib/http-errors.js";
import {
    issueTokenPair,
    verifyAccessToken,
    verifyRefreshToken,
} from "../src/lib/auth/tokens.js";

type MockedUser = {
    id: string;
    email: string;
    username: string;
    passwordHash: string;
    tokenVersion: number;
    passwordResetToken: string | null;
    passwordResetTokenExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

type PrismaMock = {
    user: {
        create: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
    };
};

describe("authRoutes", () => {
    let app: FastifyInstance;
    let prisma: PrismaMock;

    beforeEach(async () => {
        hashPasswordMock.mockClear();
        verifyPasswordMock.mockClear();
        generateResetTokenMock.mockClear();
        isResetTokenExpiredMock.mockClear();
        createResetTokenExpirationMock.mockClear();

        prisma = {
            user: {
                create: vi.fn(),
                findUnique: vi.fn(),
                findFirst: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
            },
        };

        app = Fastify({ logger: false });
        app.decorate("prisma", prisma as unknown as PrismaClient);

        app.decorate("authenticate", async (request: FastifyRequest) => {
            const authorization = request.headers.authorization;
            if (!authorization?.startsWith("Bearer ")) {
                throw unauthorized("Missing or invalid Authorization header");
            }
            const token = authorization.slice("Bearer ".length).trim();
            try {
                const payload = verifyAccessToken(token);
                (
                    request as FastifyRequest & {
                        user: { id: string; tokenVersion: number };
                    }
                ).user = {
                    id: payload.sub,
                    tokenVersion: payload.tokenVersion,
                };
            } catch {
                throw unauthorized("Invalid or expired access token");
            }
        });

        await app.register(authRoutes);
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        vi.restoreAllMocks();
    });

    it("registers a new user and returns tokens", async () => {
        prisma.user.create.mockImplementation(async ({ data }) => {
            expect(data.passwordHash).not.toBe("Password123!");

            return buildUser({
                id: "user-register",
                email: data.email,
                username: data.username,
                passwordHash: data.passwordHash,
            });
        });

        const response = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "new.user@example.com",
                password: "Password123!",
                username: "newuser",
            },
        });

        expect(response.statusCode).toBe(201);

        const payload = response.json() as {
            user: { id: string; email: string; username: string };
            accessToken: string;
            refreshToken: string;
        };

        expect(payload.user).toMatchObject({
            id: "user-register",
            email: "new.user@example.com",
            username: "newuser",
        });

        const access = verifyAccessToken(payload.accessToken);
        expect(access.sub).toBe("user-register");

        const refresh = verifyRefreshToken(payload.refreshToken);
        expect(refresh.sub).toBe("user-register");
    });

    it("rejects registration when unique constraint fails", async () => {
        prisma.user.create.mockRejectedValueOnce({ code: "P2002" });

        const response = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "existing@example.com",
                password: "Password123!",
                username: "existing",
            },
        });

        expect(response.statusCode).toBe(409);
        expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it("propagates unexpected errors during registration", async () => {
        prisma.user.create.mockRejectedValueOnce(new Error("db down"));

        const response = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "error@example.com",
                password: "Password123!",
                username: "erroruser",
            },
        });

        expect(response.statusCode).toBe(500);
        expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it("logs in an existing user with valid credentials", async () => {
        const passwordHash = await hashPassword("Password123!");
        prisma.user.findUnique.mockResolvedValueOnce(
            buildUser({
                id: "user-login",
                email: "login@example.com",
                username: "loginuser",
                passwordHash,
            })
        );

        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: {
                email: "login@example.com",
                password: "Password123!",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            accessToken: string;
            refreshToken: string;
        };

        const access = verifyAccessToken(payload.accessToken);
        expect(access.sub).toBe("user-login");
    });

    it("rejects login when user is not found", async () => {
        prisma.user.findUnique.mockResolvedValueOnce(null);

        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: {
                email: "missing@example.com",
                password: "Password123!",
            },
        });

        expect(response.statusCode).toBe(401);
    });

    it("rejects login when password is incorrect", async () => {
        const passwordHash = await hashPassword("Password123!");
        prisma.user.findUnique.mockResolvedValueOnce(
            buildUser({
                id: "user-login-fail",
                email: "fail@example.com",
                username: "failuser",
                passwordHash,
            })
        );

        verifyPasswordMock.mockResolvedValueOnce(false);

        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: {
                email: "fail@example.com",
                password: "WrongPassword!",
            },
        });

        expect(response.statusCode).toBe(401);
    });

    it("refreshes tokens when provided a valid refresh token", async () => {
        const user = buildUser({
            id: "user-refresh",
            email: "refresh@example.com",
            username: "refreshuser",
            passwordHash: "hash",
        });

        prisma.user.findUnique.mockResolvedValueOnce(user);

        const { refreshToken } = issueTokenPair({
            id: user.id,
            tokenVersion: user.tokenVersion,
        });

        const response = await app.inject({
            method: "POST",
            url: "/auth/refresh",
            payload: {
                refreshToken,
            },
        });

        expect(response.statusCode).toBe(200);

        const payload = response.json() as {
            accessToken: string;
            refreshToken: string;
        };

        const decoded = verifyRefreshToken(payload.refreshToken);
        expect(decoded.sub).toBe("user-refresh");
    });

    it("rejects refresh requests with invalid token", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/refresh",
            payload: {
                refreshToken: "invalid-token",
            },
        });

        expect(response.statusCode).toBe(401);
    });

    it("rejects refresh when tokenVersion no longer matches", async () => {
        const user = buildUser({
            id: "user-mismatch",
            email: "mismatch@example.com",
            username: "mismatch",
            tokenVersion: 1,
        });

        const { refreshToken } = issueTokenPair({
            id: user.id,
            tokenVersion: user.tokenVersion,
        });

        // Simulate tokenVersion bump in DB
        prisma.user.findUnique.mockResolvedValueOnce({
            ...user,
            tokenVersion: user.tokenVersion + 1,
        });

        const response = await app.inject({
            method: "POST",
            url: "/auth/refresh",
            payload: {
                refreshToken,
            },
        });

        expect(response.statusCode).toBe(401);
    });

    it("invalidates refresh tokens on logout by incrementing tokenVersion", async () => {
        const user = buildUser({
            id: "user-logout",
            email: "logout@example.com",
            username: "logoutuser",
            passwordHash: "hash",
        });

        prisma.user.findUnique.mockResolvedValueOnce(user);
        prisma.user.update.mockResolvedValueOnce({
            ...user,
            tokenVersion: user.tokenVersion + 1,
            updatedAt: new Date(),
        });

        const { refreshToken } = issueTokenPair({
            id: user.id,
            tokenVersion: user.tokenVersion,
        });

        const response = await app.inject({
            method: "POST",
            url: "/auth/logout",
            payload: {
                refreshToken,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: user.id },
            data: {
                tokenVersion: {
                    increment: 1,
                },
            },
        });
    });

    describe("forgot-password", () => {
        it("generates reset token for existing user", async () => {
            const user = buildUser({
                id: "user-forgot",
                email: "forgot@example.com",
                username: "forgotuser",
            });

            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 1);

            prisma.user.findUnique.mockResolvedValueOnce(user);
            prisma.user.update.mockResolvedValueOnce({
                ...user,
                passwordResetToken: "test-reset-token-123",
                passwordResetTokenExpiresAt: futureDate,
            });

            createResetTokenExpirationMock.mockReturnValueOnce(futureDate);

            const response = await app.inject({
                method: "POST",
                url: "/auth/forgot-password",
                payload: {
                    email: "forgot@example.com",
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as {
                message: string;
                resetToken?: string;
            };

            expect(payload.message).toContain(
                "If an account with that email exists"
            );
            expect(payload.resetToken).toBe("test-reset-token-123");

            expect(generateResetTokenMock).toHaveBeenCalledTimes(1);
            expect(createResetTokenExpirationMock).toHaveBeenCalledTimes(1);
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: user.id },
                data: {
                    passwordResetToken: "test-reset-token-123",
                    passwordResetTokenExpiresAt: futureDate,
                },
            });
        });

        it("returns same message even when user does not exist", async () => {
            prisma.user.findUnique.mockResolvedValueOnce(null);

            const response = await app.inject({
                method: "POST",
                url: "/auth/forgot-password",
                payload: {
                    email: "nonexistent@example.com",
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as {
                message: string;
                resetToken?: string;
            };

            expect(payload.message).toContain(
                "If an account with that email exists"
            );
            expect(payload.resetToken).toBeUndefined();

            expect(generateResetTokenMock).not.toHaveBeenCalled();
            expect(prisma.user.update).not.toHaveBeenCalled();
        });
    });

    describe("reset-password", () => {
        it("resets password with valid token", async () => {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 1);

            const user = buildUser({
                id: "user-reset",
                email: "reset@example.com",
                username: "resetuser",
                passwordHash: "old-hash",
                passwordResetToken: "test-reset-token-123",
                passwordResetTokenExpiresAt: futureDate,
            });

            prisma.user.findFirst.mockResolvedValueOnce(user);
            isResetTokenExpiredMock.mockReturnValueOnce(false);
            prisma.user.update.mockResolvedValueOnce({
                ...user,
                passwordHash: "hashed-password",
                passwordResetToken: null,
                passwordResetTokenExpiresAt: null,
                tokenVersion: user.tokenVersion + 1,
            });

            const response = await app.inject({
                method: "POST",
                url: "/auth/reset-password",
                payload: {
                    resetToken: "test-reset-token-123",
                    newPassword: "NewPassword123!",
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as {
                success: boolean;
                message: string;
            };

            expect(payload.success).toBe(true);
            expect(payload.message).toBe(
                "Password has been reset successfully"
            );

            expect(hashPasswordMock).toHaveBeenCalledWith("NewPassword123!");
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: user.id },
                data: {
                    passwordHash: "hashed-password",
                    passwordResetToken: null,
                    passwordResetTokenExpiresAt: null,
                    tokenVersion: {
                        increment: 1,
                    },
                },
            });
        });

        it("rejects reset with invalid token", async () => {
            prisma.user.findFirst.mockResolvedValueOnce(null);

            const response = await app.inject({
                method: "POST",
                url: "/auth/reset-password",
                payload: {
                    resetToken: "invalid-token",
                    newPassword: "NewPassword123!",
                },
            });

            expect(response.statusCode).toBe(404);
            const payload = response.json() as {
                statusCode: number;
                message: string;
            };

            expect(payload.message).toBe("Invalid or expired reset token");
        });

        it("rejects reset with expired token", async () => {
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - 1);

            const user = buildUser({
                id: "user-expired",
                email: "expired@example.com",
                username: "expireduser",
                passwordResetToken: "expired-token",
                passwordResetTokenExpiresAt: pastDate,
            });

            prisma.user.findFirst.mockResolvedValueOnce(user);
            isResetTokenExpiredMock.mockReturnValueOnce(true);
            prisma.user.update.mockResolvedValueOnce({
                ...user,
                passwordResetToken: null,
                passwordResetTokenExpiresAt: null,
            });

            const response = await app.inject({
                method: "POST",
                url: "/auth/reset-password",
                payload: {
                    resetToken: "expired-token",
                    newPassword: "NewPassword123!",
                },
            });

            expect(response.statusCode).toBe(400);
            const payload = response.json() as {
                statusCode: number;
                message: string;
            };

            expect(payload.message).toBe("Reset token has expired");

            // Verify expired token is cleared
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: user.id },
                data: {
                    passwordResetToken: null,
                    passwordResetTokenExpiresAt: null,
                },
            });
        });

        it("rejects reset when token expiration is null", async () => {
            const user = buildUser({
                id: "user-null-expiry",
                email: "nullexpiry@example.com",
                username: "nullexpiryuser",
                passwordResetToken: "token-with-null-expiry",
                passwordResetTokenExpiresAt: null,
            });

            prisma.user.findFirst.mockResolvedValueOnce(user);
            prisma.user.update.mockResolvedValueOnce({
                ...user,
                passwordResetToken: null,
                passwordResetTokenExpiresAt: null,
            });

            const response = await app.inject({
                method: "POST",
                url: "/auth/reset-password",
                payload: {
                    resetToken: "token-with-null-expiry",
                    newPassword: "NewPassword123!",
                },
            });

            expect(response.statusCode).toBe(400);
            const payload = response.json() as {
                statusCode: number;
                message: string;
            };
            expect(payload.message).toBe("Reset token has expired");
            // isResetTokenExpired is not called when expiration is null (short-circuit)
            expect(isResetTokenExpiredMock).not.toHaveBeenCalled();
        });
    });

    describe("delete-account", () => {
        it("deletes account with valid credentials", async () => {
            const user = buildUser({
                id: "user-delete",
                email: "delete@example.com",
                username: "deleteuser",
                passwordHash: "hashed-password",
                tokenVersion: 0,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.user.findUnique.mockResolvedValueOnce(user);
            prisma.user.delete.mockResolvedValueOnce(user);

            const response = await app.inject({
                method: "DELETE",
                url: "/auth/account",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    password: "Password123!",
                    email: "delete@example.com",
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as {
                success: boolean;
                message: string;
            };

            expect(payload.success).toBe(true);
            expect(payload.message).toBe(
                "Account has been deleted successfully"
            );

            expect(verifyPasswordMock).toHaveBeenCalledWith(
                "Password123!",
                "hashed-password"
            );
            expect(prisma.user.delete).toHaveBeenCalledWith({
                where: { id: user.id },
            });
        });

        it("rejects deletion without authorization header", async () => {
            const response = await app.inject({
                method: "DELETE",
                url: "/auth/account",
                payload: {
                    password: "Password123!",
                    email: "test@example.com",
                },
            });

            expect(response.statusCode).toBe(401);
        });

        it("rejects deletion with invalid token", async () => {
            const response = await app.inject({
                method: "DELETE",
                url: "/auth/account",
                headers: {
                    authorization: "Bearer invalid-token",
                },
                payload: {
                    password: "Password123!",
                    email: "test@example.com",
                },
            });

            expect(response.statusCode).toBe(401);
        });

        it("rejects deletion when user is not found", async () => {
            const { accessToken } = issueTokenPair({
                id: "non-existent-user",
                tokenVersion: 0,
            });

            prisma.user.findUnique.mockResolvedValueOnce(null);

            const response = await app.inject({
                method: "DELETE",
                url: "/auth/account",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    password: "Password123!",
                    email: "nonexistent@example.com",
                },
            });

            expect(response.statusCode).toBe(401);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("User not found");
        });

        it("rejects deletion when token version does not match", async () => {
            const user = buildUser({
                id: "user-token-mismatch",
                email: "mismatch@example.com",
                username: "mismatchuser",
                passwordHash: "hashed-password",
                tokenVersion: 0,
            });

            // Token created with version 0, but DB has version 1
            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: 0,
            });

            prisma.user.findUnique.mockResolvedValueOnce({
                ...user,
                tokenVersion: 1,
            });

            const response = await app.inject({
                method: "DELETE",
                url: "/auth/account",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    password: "Password123!",
                    email: "mismatch@example.com",
                },
            });

            expect(response.statusCode).toBe(401);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("Invalid or expired access token");
        });

        it("rejects deletion with incorrect password", async () => {
            const user = buildUser({
                id: "user-wrong-password",
                email: "wrongpass@example.com",
                username: "wrongpassuser",
                passwordHash: "hashed-password",
                tokenVersion: 0,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.user.findUnique.mockResolvedValueOnce(user);
            verifyPasswordMock.mockResolvedValueOnce(false);

            const response = await app.inject({
                method: "DELETE",
                url: "/auth/account",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    password: "WrongPassword!",
                    email: "wrongpass@example.com",
                },
            });

            expect(response.statusCode).toBe(401);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("Invalid password");
        });

        it("rejects deletion when email does not match", async () => {
            const user = buildUser({
                id: "user-email-mismatch",
                email: "correct@example.com",
                username: "emailuser",
                passwordHash: "hashed-password",
                tokenVersion: 0,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.user.findUnique.mockResolvedValueOnce(user);

            const response = await app.inject({
                method: "DELETE",
                url: "/auth/account",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    password: "Password123!",
                    email: "wrong@example.com",
                },
            });

            expect(response.statusCode).toBe(401);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("Email does not match");
        });
    });
});

function buildUser(overrides: Partial<MockedUser>): MockedUser {
    const base: MockedUser = {
        id: "user-id",
        email: "user@example.com",
        username: "username",
        passwordHash: "hash",
        tokenVersion: 0,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    };

    return { ...base, ...overrides };
}
