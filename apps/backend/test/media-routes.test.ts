import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import { mediaRoutes } from "../src/routes/v1/media.js";
import {
    omdbDetailMovieResponse,
    omdbDetailSeriesResponse,
    omdbSearchNotFoundResponse,
    omdbSearchSuccessResponse,
} from "./fixtures/omdb.js";

const originalFetch = globalThis.fetch;

describe("mediaRoutes", () => {
    let app: FastifyInstance;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        fetchMock = vi.fn();
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

        app = Fastify({ logger: false });
        await app.register(mediaRoutes);
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        vi.useRealTimers();
        vi.restoreAllMocks();
        globalThis.fetch = originalFetch;
    });

    it("returns mapped media items when OMDb responds with results", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbSearchSuccessResponse,
        });

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbDetailMovieResponse,
        });

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbDetailSeriesResponse,
        });

        const response = await app.inject({
            method: "GET",
            url: "/media",
            query: {
                query: "sample",
                limit: "2",
            },
        });

        expect(response.statusCode).toBe(200);

        const payload = response.json() as {
            items: Array<Record<string, unknown>>;
            hasMore: boolean;
            nextPage: number | null;
        };

        expect(payload.items).toHaveLength(2);
        expect(payload).toMatchObject({
            hasMore: true,
            nextPage: 2,
        });

        expect(payload.items[0]).toMatchObject({
            id: "tt0000001",
            title: "Sample Movie",
            description: "An exciting plot.",
            mediaType: "MOVIE",
            posterUrl: "https://example.com/poster.jpg",
            totalSeasons: null,
            totalEpisodes: null,
        });

        expect(payload.items[1]).toMatchObject({
            id: "tt0000002",
            title: "Sample Series",
            mediaType: "TV",
            totalSeasons: 2,
            totalEpisodes: 24,
        });

        expect(payload.items[0].createdAt).toBe("2024-01-01T00:00:00.000Z");
        expect(payload.items[0].updatedAt).toBe("2024-01-01T00:00:00.000Z");

        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("returns empty list when OMDb reports no matches", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbSearchNotFoundResponse,
        });

        const response = await app.inject({
            method: "GET",
            url: "/media",
            query: {
                query: "does not exist",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            items: unknown[];
            hasMore: boolean;
            nextPage: number | null;
        };

        expect(payload.items).toHaveLength(0);
        expect(payload.hasMore).toBe(false);
        expect(payload.nextPage).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("short-circuits when query is only whitespace", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/media",
            query: {
                query: "   ",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            items: unknown[];
            hasMore: boolean;
            nextPage: number | null;
        };

        expect(payload.items).toHaveLength(0);
        expect(payload.hasMore).toBe(false);
        expect(payload.nextPage).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
