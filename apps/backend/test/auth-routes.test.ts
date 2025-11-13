import type { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hashPasswordMock, verifyPasswordMock } = vi.hoisted(() => ({
    hashPasswordMock: vi.fn(async () => "hashed-password"),
    verifyPasswordMock: vi.fn(
        async (password: string, hash: string) =>
            hash === "hashed-password" && password === "Password123!"
    ),
}));

vi.mock("../src/lib/auth/password.js", () => ({
    hashPassword: hashPasswordMock,
    verifyPassword: verifyPasswordMock,
    __esModule: true,
}));

import { hashPassword } from "../src/lib/auth/password.js";
import { authRoutes } from "../src/routes/v1/auth.js";
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
    createdAt: Date;
    updatedAt: Date;
};

type PrismaMock = {
    user: {
        create: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };
};

describe("authRoutes", () => {
    let app: FastifyInstance;
    let prisma: PrismaMock;

    beforeEach(async () => {
        hashPasswordMock.mockClear();
        verifyPasswordMock.mockClear();

        prisma = {
            user: {
                create: vi.fn(),
                findUnique: vi.fn(),
                update: vi.fn(),
            },
        };

        app = Fastify({ logger: false });
        app.decorate("prisma", prisma as unknown as PrismaClient);
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
});

function buildUser(overrides: Partial<MockedUser>): MockedUser {
    const base: MockedUser = {
        id: "user-id",
        email: "user@example.com",
        username: "username",
        passwordHash: "hash",
        tokenVersion: 0,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    };

    return { ...base, ...overrides };
}
