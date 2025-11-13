import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

import { mediaRoutes } from "../src/routes/v1/media.js";
import {
    omdbDetailAnimeResponse,
    omdbDetailLimitedMovieResponse,
    omdbDetailMovieResponse,
    omdbDetailOffsetMovieResponse,
    omdbDetailSeriesResponse,
    omdbSearchAnimeResponse,
    omdbSearchDupesResponse,
    omdbSearchLimitedResultsResponse,
    omdbSearchNotFoundResponse,
    omdbSearchOffsetResponse,
    omdbSearchSingleFallbackResponse,
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

    it("returns media item details for a known id", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbDetailMovieResponse,
        });

        const response = await app.inject({
            method: "GET",
            url: "/media/tt0000001",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as Record<string, unknown>;

        expect(payload).toMatchObject({
            id: "tt0000001",
            externalId: "tt0000001",
            title: "Sample Movie",
            mediaType: "MOVIE",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const firstCallUrl = new URL(fetchMock.mock.calls[0][0] as string);
        expect(firstCallUrl.searchParams.get("i")).toBe("tt0000001");
        expect(firstCallUrl.searchParams.get("plot")).toBe("short");
    });

    it("returns 404 when OMDb reports the media id is missing", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                Response: "False",
                Error: "Movie not found!",
            }),
        });

        const response = await app.inject({
            method: "GET",
            url: "/media/unknown-id",
        });

        expect(response.statusCode).toBe(404);
        const payload = response.json() as Record<string, unknown>;

        expect(payload).toMatchObject({
            statusCode: 404,
            error: "Not Found",
            message: "Media item not found",
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const firstCallUrl = new URL(fetchMock.mock.calls[0][0] as string);
        expect(firstCallUrl.searchParams.get("i")).toBe("unknown-id");
    });

    it("returns 404 without calling OMDb when id is only whitespace", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/media/%20%20%20",
        });

        expect(response.statusCode).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
        const payload = response.json() as Record<string, unknown>;
        expect(payload).toMatchObject({
            statusCode: 404,
            error: "Not Found",
            message: "Media item not found",
        });
    });

    it("returns 500 when OMDb detail lookup fails with a non-not-found error", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                Response: "False",
                Error: "Internal error",
            }),
        });

        const response = await app.inject({
            method: "GET",
            url: "/media/ttError",
        });

        expect(response.statusCode).toBe(500);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when OMDb request responds with non-OK status", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 503,
            text: async () => "Service unavailable",
        });

        const response = await app.inject({
            method: "GET",
            url: "/media/ttServiceDown",
        });

        expect(response.statusCode).toBe(500);
        expect(fetchMock).toHaveBeenCalledTimes(1);
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

    it("falls back to search data when detail lookup fails", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbSearchSingleFallbackResponse,
        });

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                Response: "False",
                Error: "Detail not found",
            }),
        });

        const response = await app.inject({
            method: "GET",
            url: "/media",
            query: {
                query: "fallback",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            items: Array<Record<string, unknown>>;
            hasMore: boolean;
            nextPage: number | null;
        };

        expect(payload.items).toHaveLength(1);
        const item = payload.items[0];

        expect(item).toMatchObject({
            id: "tt0000003",
            posterUrl: null,
            mediaType: "MOVIE",
            releaseDate: "1999-01-01T00:00:00.000Z",
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("maps missing detail fields to nulls when OMDb data is unavailable", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                Response: "True",
                Search: [
                    {
                        Title: "Mystery Entry",
                        imdbID: "ttMissingFields",
                        Type: "movie",
                    },
                ],
                totalResults: "1",
            }),
        });

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                Response: "True",
                Title: "Mystery Entry",
                imdbID: "ttMissingFields",
                Plot: "N/A",
                Poster: "N/A",
                Released: "not-a-date",
                Year: "N/A",
            }),
        });

        const response = await app.inject({
            method: "GET",
            url: "/media",
            query: {
                query: "mystery",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            items: Array<Record<string, unknown>>;
        };

        expect(payload.items).toHaveLength(1);
        expect(payload.items[0]).toMatchObject({
            id: "ttMissingFields",
            description: null,
            posterUrl: null,
            releaseDate: null,
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("classifies anime titles when genre data indicates anime", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbSearchAnimeResponse,
        });

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbDetailAnimeResponse,
        });

        const response = await app.inject({
            method: "GET",
            url: "/media",
            query: {
                query: "anime",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            items: Array<Record<string, unknown>>;
            hasMore: boolean;
            nextPage: number | null;
        };

        expect(payload.items).toHaveLength(1);
        const item = payload.items[0];

        expect(item).toMatchObject({
            id: "tt0000004",
            mediaType: "ANIME",
            releaseDate: "2001-01-01T00:00:00.000Z",
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("deduplicates search results based on imdbID", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbSearchDupesResponse,
        });

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbDetailMovieResponse,
        });

        const response = await app.inject({
            method: "GET",
            url: "/media",
            query: {
                query: "dupe",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            items: Array<Record<string, unknown>>;
            hasMore: boolean;
            nextPage: number | null;
        };

        expect(payload.items).toHaveLength(1);
        expect(payload.hasMore).toBe(true);
        expect(payload.nextPage).toBe(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("reports lack of next page when total results exhausted", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbSearchLimitedResultsResponse,
        });

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbDetailLimitedMovieResponse,
        });

        const response = await app.inject({
            method: "GET",
            url: "/media",
            query: {
                query: "limited",
                limit: "1",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            items: Array<Record<string, unknown>>;
            hasMore: boolean;
            nextPage: number | null;
        };

        expect(payload.items).toHaveLength(1);
        expect(payload.hasMore).toBe(false);
        expect(payload.nextPage).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("skips to the proper OMDb page when offset requires it", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbSearchOffsetResponse,
        });
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => omdbDetailOffsetMovieResponse,
        });

        const response = await app.inject({
            method: "GET",
            url: "/media",
            query: {
                query: "paged",
                limit: "1",
                page: "11",
            },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as {
            items: Array<Record<string, unknown>>;
            hasMore: boolean;
            nextPage: number | null;
        };

        expect(payload.items).toHaveLength(1);
        expect(payload.nextPage).toBe(12);
        expect(payload.hasMore).toBe(true);
        expect(payload.items[0]).toMatchObject({
            id: "ttOffset11",
            title: "Paged Movie 11",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const firstCallUrl = new URL(fetchMock.mock.calls[0][0] as string);
        expect(firstCallUrl.searchParams.get("page")).toBe("2");
    });
});
