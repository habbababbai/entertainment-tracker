import type { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { watchlistRoutes } from "../src/routes/v1/watchlist.js";
import { unauthorized } from "../src/lib/http-errors.js";
import {
    issueTokenPair,
    verifyAccessToken,
} from "../src/lib/auth/tokens.js";
import * as omdbModule from "../src/lib/omdb/index.js";

type MockedMediaItem = {
    id: string;
    externalId: string;
    source: string;
    title: string;
    description: string | null;
    posterUrl: string | null;
    backdropUrl: string | null;
    mediaType: string;
    totalSeasons: number | null;
    totalEpisodes: number | null;
    releaseDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

type MockedWatchEntry = {
    id: string;
    userId: string;
    mediaItemId: string;
    status: string;
    rating: number | null;
    notes: string | null;
    lastWatchedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    mediaItem?: MockedMediaItem;
};

type PrismaMock = {
    mediaItem: {
        findUnique: ReturnType<typeof vi.fn>;
        upsert: ReturnType<typeof vi.fn>;
    };
    watchEntry: {
        create: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
    };
};

describe("watchlistRoutes", () => {
    let app: FastifyInstance;
    let prisma: PrismaMock;
    let requestOmdbSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        prisma = {
            mediaItem: {
                findUnique: vi.fn(),
                upsert: vi.fn(),
            },
            watchEntry: {
                create: vi.fn(),
                findUnique: vi.fn(),
                findMany: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
            },
        };

        requestOmdbSpy = vi.spyOn(omdbModule, "requestOmdb").mockImplementation(
            async () => {
                return {
                    Response: "False",
                    Error: "Movie not found!",
                } as never;
            }
        );

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

        await app.register(watchlistRoutes);
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        vi.restoreAllMocks();
    });

    describe("POST /watchlist", () => {
        it("adds media item to watchlist", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({
                id: "media-1",
                externalId: "tt0000001",
                title: "Test Movie",
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(null);
            prisma.watchEntry.create.mockResolvedValueOnce({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
                status: "PLANNED",
                rating: null,
                notes: null,
                lastWatchedAt: null,
                createdAt: new Date("2024-01-01T00:00:00.000Z"),
                updatedAt: new Date("2024-01-01T00:00:00.000Z"),
                mediaItem,
            });

            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    mediaItemId: mediaItem.id,
                },
            });

            expect(response.statusCode).toBe(201);
            const payload = response.json() as MockedWatchEntry;

            expect(payload.id).toBe("entry-1");
            expect(payload.userId).toBe(user.id);
            expect(payload.mediaItemId).toBe(mediaItem.id);
            expect(payload.status).toBe("PLANNED");
            expect(payload.mediaItem).toMatchObject({
                id: mediaItem.id,
                title: "Test Movie",
            });

            expect(prisma.watchEntry.create).toHaveBeenCalledWith({
                data: {
                    userId: user.id,
                    mediaItemId: mediaItem.id,
                    status: "PLANNED",
                },
                include: {
                    mediaItem: true,
                },
            });
        });

        it("rejects adding item when media item does not exist", async () => {
            const user = buildUser({ id: "user-1" });
            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.mediaItem.findUnique.mockResolvedValue(null);

            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    mediaItemId: "non-existent-id",
                },
            });

            expect(response.statusCode).toBe(404);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("Media item not found");
        });

        it("rejects adding item that is already in watchlist", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });
            const existingEntry = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(existingEntry);

            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    mediaItemId: mediaItem.id,
                },
            });

            expect(response.statusCode).toBe(409);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("Item already in watchlist");
        });

        it("rejects request without authorization", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                payload: {
                    mediaItemId: "media-1",
                },
            });

            expect(response.statusCode).toBe(401);
        });

        it("rejects request with invalid token", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: "Bearer invalid-token",
                },
                payload: {
                    mediaItemId: "media-1",
                },
            });

            expect(response.statusCode).toBe(401);
        });

        it("creates media item from OMDb when not in database", async () => {
            const user = buildUser({ id: "user-1" });
            const externalId = "tt1234567";
            const omdbResponse = {
                Response: "True",
                imdbID: externalId,
                Title: "New Movie",
                Type: "movie",
                Plot: "A new movie plot",
                Poster: "https://example.com/poster.jpg",
                Year: "2024",
                Released: "2024-01-15",
            };

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.mediaItem.findUnique.mockResolvedValue(null);

            requestOmdbSpy.mockResolvedValueOnce(omdbResponse as never);

            const createdMediaItem = buildMediaItem({
                id: "new-media-id",
                externalId,
                title: "New Movie",
                description: "A new movie plot",
                posterUrl: "https://example.com/poster.jpg",
                releaseDate: new Date("2024-01-15T00:00:00.000Z"),
            });
            prisma.mediaItem.upsert = vi.fn().mockResolvedValue(createdMediaItem);

            prisma.watchEntry.findUnique.mockResolvedValueOnce(null);
            prisma.watchEntry.create.mockResolvedValueOnce({
                id: "entry-1",
                userId: user.id,
                mediaItemId: createdMediaItem.id,
                status: "PLANNED",
                rating: null,
                notes: null,
                lastWatchedAt: null,
                createdAt: new Date("2024-01-01T00:00:00.000Z"),
                updatedAt: new Date("2024-01-01T00:00:00.000Z"),
                mediaItem: createdMediaItem,
            });

            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    mediaItemId: externalId,
                },
            });

            expect(response.statusCode).toBe(201);
            expect(prisma.mediaItem.upsert).toHaveBeenCalled();
        });

        it("updates existing media item from OMDb when externalId matches", async () => {
            const user = buildUser({ id: "user-1" });
            const externalId = "tt1234567";
            const existingMediaItem = buildMediaItem({
                id: "existing-media-id",
                externalId,
                title: "Old Title",
            });
            const omdbResponse = {
                Response: "True",
                imdbID: externalId,
                Title: "Updated Movie",
                Type: "movie",
                Plot: "Updated plot",
                Poster: "https://example.com/new-poster.jpg",
                Year: "2024",
                Released: "2024-01-20",
            };

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.mediaItem.findUnique.mockResolvedValue(null);

            requestOmdbSpy.mockResolvedValueOnce(omdbResponse as never);

            const updatedMediaItem = buildMediaItem({
                id: existingMediaItem.id,
                externalId,
                title: "Updated Movie",
                description: "Updated plot",
                posterUrl: "https://example.com/new-poster.jpg",
                releaseDate: new Date("2024-01-20T00:00:00.000Z"),
            });
            prisma.mediaItem.upsert = vi.fn().mockResolvedValue(updatedMediaItem);

            prisma.watchEntry.findUnique.mockResolvedValueOnce(null);
            prisma.watchEntry.create.mockResolvedValueOnce({
                id: "entry-1",
                userId: user.id,
                mediaItemId: updatedMediaItem.id,
                status: "PLANNED",
                rating: null,
                notes: null,
                lastWatchedAt: null,
                createdAt: new Date("2024-01-01T00:00:00.000Z"),
                updatedAt: new Date("2024-01-01T00:00:00.000Z"),
                mediaItem: updatedMediaItem,
            });

            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    mediaItemId: externalId,
                },
            });

            expect(response.statusCode).toBe(201);
            expect(prisma.mediaItem.upsert).toHaveBeenCalled();
        });

        it("handles OMDb error other than movie not found", async () => {
            const user = buildUser({ id: "user-1" });
            const externalId = "tt1234567";

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.mediaItem.findUnique.mockResolvedValue(null);

            requestOmdbSpy.mockResolvedValueOnce({
                Response: "False",
                Error: "API key invalid",
            } as never);

            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    mediaItemId: externalId,
                },
            });

            expect(response.statusCode).toBe(500);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("API key invalid");
        });

        it("handles OMDb error with undefined error message", async () => {
            const user = buildUser({ id: "user-1" });
            const externalId = "tt1234567";

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.mediaItem.findUnique.mockResolvedValue(null);

            requestOmdbSpy.mockResolvedValueOnce({
                Response: "False",
                Error: undefined,
            } as never);

            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    mediaItemId: externalId,
                },
            });

            expect(response.statusCode).toBe(500);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("Unknown OMDb detail error");
        });

        it("handles OMDb response with null mapped result", async () => {
            const user = buildUser({ id: "user-1" });
            const externalId = "tt1234567";

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.mediaItem.findUnique.mockResolvedValue(null);

            requestOmdbSpy.mockResolvedValueOnce({
                Response: "True",
                imdbID: externalId,
                Title: "Movie",
            } as never);

            const omdbModule = await import("../src/lib/omdb/index.js");
            const mapOmdbDetailSpy = vi
                .spyOn(omdbModule, "mapOmdbDetail")
                .mockReturnValue(null);

            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    mediaItemId: externalId,
                },
            });

            expect(response.statusCode).toBe(404);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("Media item not found");

            mapOmdbDetailSpy.mockRestore();
        });

        it("finds media item by externalId when not found by internal ID", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({
                id: "media-1",
                externalId: "tt1234567",
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.mediaItem.findUnique.mockImplementation((args: {
                where: { id?: string; externalId?: string };
            }) => {
                if (args.where.id === "tt1234567") {
                    return Promise.resolve(null);
                }
                if (args.where.externalId === "tt1234567") {
                    return Promise.resolve(mediaItem);
                }
                return Promise.resolve(null);
            });

            prisma.watchEntry.findUnique.mockResolvedValueOnce(null);
            prisma.watchEntry.create.mockResolvedValueOnce({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
                status: "PLANNED",
                rating: null,
                notes: null,
                lastWatchedAt: null,
                createdAt: new Date("2024-01-01T00:00:00.000Z"),
                updatedAt: new Date("2024-01-01T00:00:00.000Z"),
                mediaItem,
            });

            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    mediaItemId: "tt1234567",
                },
            });

            expect(response.statusCode).toBe(201);
        });

        it("handles media item with null releaseDate from OMDb", async () => {
            const user = buildUser({ id: "user-1" });
            const externalId = "tt1234567";
            const omdbResponse = {
                Response: "True",
                imdbID: externalId,
                Title: "Movie Without Release Date",
                Type: "movie",
                Plot: "A movie",
                Poster: "N/A",
                Year: "N/A",
                Released: "N/A",
            };

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.mediaItem.findUnique.mockResolvedValue(null);
            requestOmdbSpy.mockResolvedValueOnce(omdbResponse as never);

            const createdMediaItem = buildMediaItem({
                id: "new-media-id",
                externalId,
                title: "Movie Without Release Date",
                releaseDate: null,
            });
            prisma.mediaItem.upsert = vi.fn().mockResolvedValue(createdMediaItem);

            prisma.watchEntry.findUnique.mockResolvedValueOnce(null);
            prisma.watchEntry.create.mockResolvedValueOnce({
                id: "entry-1",
                userId: user.id,
                mediaItemId: createdMediaItem.id,
                status: "PLANNED",
                rating: null,
                notes: null,
                lastWatchedAt: null,
                createdAt: new Date("2024-01-01T00:00:00.000Z"),
                updatedAt: new Date("2024-01-01T00:00:00.000Z"),
                mediaItem: createdMediaItem,
            });

            const response = await app.inject({
                method: "POST",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    mediaItemId: externalId,
                },
            });

            expect(response.statusCode).toBe(201);
            expect(prisma.mediaItem.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        releaseDate: null,
                    }),
                })
            );
        });
    });

    describe("DELETE /watchlist/:mediaItemId", () => {
        it("removes item from watchlist", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });
            const watchEntry = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(watchEntry);
            prisma.watchEntry.delete.mockResolvedValueOnce(watchEntry);

            const response = await app.inject({
                method: "DELETE",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as {
                success: boolean;
                message: string;
            };

            expect(payload.success).toBe(true);
            expect(payload.message).toBe("Item removed from watchlist");

            expect(prisma.watchEntry.delete).toHaveBeenCalledWith({
                where: {
                    userId_mediaItemId: {
                        userId: user.id,
                        mediaItemId: mediaItem.id,
                    },
                },
            });
        });

        it("rejects deletion when item is not in watchlist", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(null);

            const response = await app.inject({
                method: "DELETE",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });

            expect(response.statusCode).toBe(404);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("Item not found in watchlist");
        });

        it("rejects deletion without authorization", async () => {
            const response = await app.inject({
                method: "DELETE",
                url: "/watchlist/media-1",
            });

            expect(response.statusCode).toBe(401);
        });

        it("rejects deletion with invalid token", async () => {
            const response = await app.inject({
                method: "DELETE",
                url: "/watchlist/media-1",
                headers: {
                    authorization: "Bearer invalid-token",
                },
            });

            expect(response.statusCode).toBe(401);
        });
    });

    describe("GET /watchlist", () => {
        it("returns user's watchlist items", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem1 = buildMediaItem({
                id: "media-1",
                title: "Movie 1",
            });
            const mediaItem2 = buildMediaItem({
                id: "media-2",
                title: "Movie 2",
            });

            const watchEntry1 = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem1.id,
                mediaItem: mediaItem1,
            });

            const watchEntry2 = buildWatchEntry({
                id: "entry-2",
                userId: user.id,
                mediaItemId: mediaItem2.id,
                mediaItem: mediaItem2,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.watchEntry.findMany.mockResolvedValueOnce([
                watchEntry1,
                watchEntry2,
            ]);

            const response = await app.inject({
                method: "GET",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as {
                items: MockedWatchEntry[];
            };

            expect(payload.items).toHaveLength(2);
            expect(payload.items[0]).toMatchObject({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem1.id,
                mediaItem: {
                    id: mediaItem1.id,
                    title: "Movie 1",
                },
            });
            expect(payload.items[1]).toMatchObject({
                id: "entry-2",
                userId: user.id,
                mediaItemId: mediaItem2.id,
            });

            expect(prisma.watchEntry.findMany).toHaveBeenCalledWith({
                where: {
                    userId: user.id,
                },
                include: {
                    mediaItem: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            });
        });

        it("returns empty array when user has no watchlist items", async () => {
            const user = buildUser({ id: "user-1" });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            prisma.watchEntry.findMany.mockResolvedValueOnce([]);

            const response = await app.inject({
                method: "GET",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as {
                items: MockedWatchEntry[];
            };

            expect(payload.items).toHaveLength(0);
        });

        it("rejects request without authorization", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/watchlist",
            });

            expect(response.statusCode).toBe(401);
        });

        it("rejects request with invalid token", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/watchlist",
                headers: {
                    authorization: "Bearer invalid-token",
                },
            });

            expect(response.statusCode).toBe(401);
        });

        it("only returns watchlist items for authenticated user", async () => {
            const user1 = buildUser({ id: "user-1" });
            const user2 = buildUser({ id: "user-2" });
            const mediaItem = buildMediaItem({ id: "media-1" });

            const user1Entry = buildWatchEntry({
                id: "entry-1",
                userId: user1.id,
                mediaItemId: mediaItem.id,
                mediaItem,
            });

            const { accessToken } = issueTokenPair({
                id: user1.id,
                tokenVersion: user1.tokenVersion,
            });

            prisma.watchEntry.findMany.mockResolvedValueOnce([user1Entry]);

            const response = await app.inject({
                method: "GET",
                url: "/watchlist",
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as {
                items: MockedWatchEntry[];
            };

            expect(payload.items).toHaveLength(1);
            expect(payload.items[0].userId).toBe(user1.id);
            expect(payload.items[0].userId).not.toBe(user2.id);

            expect(prisma.watchEntry.findMany).toHaveBeenCalledWith({
                where: {
                    userId: user1.id,
                },
                include: {
                    mediaItem: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            });
        });
    });

    describe("PATCH /watchlist/:mediaItemId", () => {
        it("updates watchlist entry status", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });
            const watchEntry = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
                status: "PLANNED",
                mediaItem,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(watchEntry);
            prisma.watchEntry.update.mockResolvedValueOnce({
                ...watchEntry,
                status: "WATCHING",
                mediaItem,
            });

            const response = await app.inject({
                method: "PATCH",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    status: "WATCHING",
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as MockedWatchEntry;

            expect(payload.status).toBe("WATCHING");
            expect(prisma.watchEntry.update).toHaveBeenCalledWith({
                where: {
                    userId_mediaItemId: {
                        userId: user.id,
                        mediaItemId: mediaItem.id,
                    },
                },
                data: {
                    status: "WATCHING",
                },
                include: {
                    mediaItem: true,
                },
            });
        });

        it("updates watchlist entry rating", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });
            const watchEntry = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
                rating: null,
                mediaItem,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(watchEntry);
            prisma.watchEntry.update.mockResolvedValueOnce({
                ...watchEntry,
                rating: 8,
                mediaItem,
            });

            const response = await app.inject({
                method: "PATCH",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    rating: 8,
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as MockedWatchEntry;

            expect(payload.rating).toBe(8);
        });

        it("updates watchlist entry notes", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });
            const watchEntry = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
                notes: null,
                mediaItem,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(watchEntry);
            prisma.watchEntry.update.mockResolvedValueOnce({
                ...watchEntry,
                notes: "Great movie!",
                mediaItem,
            });

            const response = await app.inject({
                method: "PATCH",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    notes: "Great movie!",
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as MockedWatchEntry;

            expect(payload.notes).toBe("Great movie!");
        });

        it("updates multiple fields at once", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });
            const watchEntry = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
                status: "PLANNED",
                rating: null,
                notes: null,
                mediaItem,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            const lastWatched = new Date("2024-01-15T00:00:00.000Z");
            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(watchEntry);
            prisma.watchEntry.update.mockResolvedValueOnce({
                ...watchEntry,
                status: "COMPLETED",
                rating: 9,
                notes: "Amazing!",
                lastWatchedAt: lastWatched,
                mediaItem,
            });

            const response = await app.inject({
                method: "PATCH",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    status: "COMPLETED",
                    rating: 9,
                    notes: "Amazing!",
                    lastWatchedAt: lastWatched.toISOString(),
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as MockedWatchEntry;

            expect(payload.status).toBe("COMPLETED");
            expect(payload.rating).toBe(9);
            expect(payload.notes).toBe("Amazing!");
            expect(payload.lastWatchedAt).toBe(lastWatched.toISOString());
        });

        it("updates lastWatchedAt to null when explicitly set", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });
            const watchEntry = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
                lastWatchedAt: new Date("2024-01-15T00:00:00.000Z"),
                mediaItem,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(watchEntry);
            prisma.watchEntry.update.mockResolvedValueOnce({
                ...watchEntry,
                lastWatchedAt: null,
                mediaItem,
            });

            const response = await app.inject({
                method: "PATCH",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    lastWatchedAt: null,
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as MockedWatchEntry;
            expect(payload.lastWatchedAt).toBeNull();
            expect(prisma.watchEntry.update).toHaveBeenCalledWith({
                where: {
                    userId_mediaItemId: {
                        userId: user.id,
                        mediaItemId: mediaItem.id,
                    },
                },
                data: {
                    lastWatchedAt: null,
                },
                include: {
                    mediaItem: true,
                },
            });
        });

        it("rejects invalid rating", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });
            const watchEntry = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
                mediaItem,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(watchEntry);

            const response = await app.inject({
                method: "PATCH",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    rating: 15,
                },
            });

            expect(response.statusCode).toBe(400);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toContain("rating");
            expect(payload.message).toContain("10");
        });

        it("returns unchanged entry when no update data provided", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });
            const watchEntry = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
                status: "PLANNED",
                mediaItem,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(watchEntry);

            const response = await app.inject({
                method: "PATCH",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {},
            });

            expect(response.statusCode).toBe(200);
            expect(prisma.watchEntry.update).not.toHaveBeenCalled();
        });

        it("rejects update when item not in watchlist", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(null);

            const response = await app.inject({
                method: "PATCH",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
                payload: {
                    status: "WATCHING",
                },
            });

            expect(response.statusCode).toBe(404);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("Item not found in watchlist");
        });

        it("rejects update without authorization", async () => {
            const response = await app.inject({
                method: "PATCH",
                url: "/watchlist/media-1",
                payload: {
                    status: "WATCHING",
                },
            });

            expect(response.statusCode).toBe(401);
        });
    });

    describe("GET /watchlist/:mediaItemId", () => {
        it("returns specific watchlist entry", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({
                id: "media-1",
                title: "Test Movie",
            });
            const watchEntry = buildWatchEntry({
                id: "entry-1",
                userId: user.id,
                mediaItemId: mediaItem.id,
                status: "WATCHING",
                rating: 8,
                notes: "Good movie",
                mediaItem,
            });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(watchEntry);

            const response = await app.inject({
                method: "GET",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });

            expect(response.statusCode).toBe(200);
            const payload = response.json() as MockedWatchEntry;

            expect(payload.id).toBe("entry-1");
            expect(payload.userId).toBe(user.id);
            expect(payload.mediaItemId).toBe(mediaItem.id);
            expect(payload.status).toBe("WATCHING");
            expect(payload.rating).toBe(8);
            expect(payload.notes).toBe("Good movie");
            expect(payload.mediaItem).toMatchObject({
                id: mediaItem.id,
                title: "Test Movie",
            });
        });

        it("rejects when item not in watchlist", async () => {
            const user = buildUser({ id: "user-1" });
            const mediaItem = buildMediaItem({ id: "media-1" });

            const { accessToken } = issueTokenPair({
                id: user.id,
                tokenVersion: user.tokenVersion,
            });

            mockMediaItemFindUnique(prisma, mediaItem);
            prisma.watchEntry.findUnique.mockResolvedValueOnce(null);

            const response = await app.inject({
                method: "GET",
                url: `/watchlist/${mediaItem.id}`,
                headers: {
                    authorization: `Bearer ${accessToken}`,
                },
            });

            expect(response.statusCode).toBe(404);
            const payload = response.json() as {
                message: string;
            };
            expect(payload.message).toBe("Item not found in watchlist");
        });

        it("rejects request without authorization", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/watchlist/media-1",
            });

            expect(response.statusCode).toBe(401);
        });

        it("rejects request with invalid token", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/watchlist/media-1",
                headers: {
                    authorization: "Bearer invalid-token",
                },
            });

            expect(response.statusCode).toBe(401);
        });
    });
});

function buildUser(overrides: { id: string; tokenVersion?: number }) {
    return {
        id: overrides.id,
        tokenVersion: overrides.tokenVersion ?? 0,
    };
}

function buildMediaItem(
    overrides: Partial<MockedMediaItem>
): MockedMediaItem {
    const base: MockedMediaItem = {
        id: "media-id",
        externalId: "tt0000001",
        source: "omdb",
        title: "Test Movie",
        description: "Test description",
        posterUrl: "https://example.com/poster.jpg",
        backdropUrl: "https://example.com/backdrop.jpg",
        mediaType: "MOVIE",
        totalSeasons: null,
        totalEpisodes: null,
        releaseDate: new Date("2024-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    };

    return { ...base, ...overrides };
}

function buildWatchEntry(
    overrides: Partial<MockedWatchEntry>
): MockedWatchEntry {
    const base: MockedWatchEntry = {
        id: "entry-id",
        userId: "user-id",
        mediaItemId: "media-id",
        status: "PLANNED",
        rating: null,
        notes: null,
        lastWatchedAt: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    };

    return { ...base, ...overrides };
}

function mockMediaItemFindUnique(
    prismaMock: PrismaMock,
    mediaItem: MockedMediaItem
) {
    prismaMock.mediaItem.findUnique.mockImplementation((args: {
        where: { id?: string; externalId?: string };
    }) => {
        if (args.where.id === mediaItem.id) {
            return Promise.resolve(mediaItem);
        }
        if (args.where.externalId === mediaItem.externalId) {
            return Promise.resolve(mediaItem);
        }
        return Promise.resolve(null);
    });
}

