import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
    mediaItemSchema,
    mediaListSchema,
    type MediaItem,
    type MediaList,
    mediaTypeSchema,
} from "@entertainment-tracker/contracts";

import {
    mapOmdbDetail,
    mapSearchFallback,
    requestOmdb,
} from "../../lib/omdb/index.js";
import {
    type OmdbDetailResponse,
    type OmdbSearchItem,
    type OmdbSearchResponse,
} from "../../types/omdb.js";

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 15;
const OMDB_PAGE_SIZE = 10;
const MAX_OMDB_PAGES = 100;

const mediaItemResponseSchema = {
    type: "object",
    properties: {
        id: { type: "string" },
        externalId: { type: "string" },
        source: { type: "string" },
        title: { type: "string" },
        description: {
            type: ["string", "null"],
        },
        posterUrl: { type: ["string", "null"] },
        backdropUrl: {
            type: ["string", "null"],
        },
        mediaType: {
            type: "string",
            enum: mediaTypeSchema.options,
        },
        totalSeasons: {
            type: ["integer", "null"],
        },
        totalEpisodes: {
            type: ["integer", "null"],
        },
        releaseDate: {
            type: ["string", "null"],
        },
        createdAt: {
            type: ["string", "null"],
        },
        updatedAt: {
            type: ["string", "null"],
        },
    },
    required: ["id", "externalId", "source", "title", "mediaType"],
} as const;

export const mediaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get(
        "/media/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: {
                        id: { type: "string", minLength: 1 },
                    },
                    required: ["id"],
                    additionalProperties: false,
                },
                response: {
                    200: mediaItemResponseSchema,
                    404: {
                        type: "object",
                        properties: {
                            statusCode: { type: "integer", const: 404 },
                            error: { type: "string" },
                            message: { type: "string" },
                        },
                        required: ["statusCode", "error", "message"],
                    },
                },
            },
        },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const mediaItem = await fetchOmdbMediaById(app, id);

            if (!mediaItem) {
                return reply.status(404).send({
                    statusCode: 404,
                    error: "Not Found",
                    message: "Media item not found",
                });
            }

            return mediaItemSchema.parse(mediaItem);
        }
    );

    app.get(
        "/media",
        {
            schema: {
                querystring: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            minLength: 1,
                        },
                        limit: {
                            type: "integer",
                            minimum: 1,
                            maximum: MAX_LIMIT,
                            default: DEFAULT_LIMIT,
                        },
                        page: {
                            type: "integer",
                            minimum: 1,
                            default: 1,
                        },
                    },
                    required: ["query"],
                    additionalProperties: false,
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            items: {
                                type: "array",
                                items: mediaItemResponseSchema,
                            },
                            hasMore: { type: "boolean" },
                            nextPage: {
                                anyOf: [
                                    { type: "integer", minimum: 1 },
                                    { type: "null" },
                                ],
                            },
                        },
                        required: ["items", "hasMore"],
                    },
                },
            },
        },
        async (request) => {
            const { limit = DEFAULT_LIMIT, query } = request.query as {
                limit?: number;
                query: string;
                page?: number;
            };

            const page =
                typeof (request.query as { page?: number }).page === "number"
                    ? Math.max(
                          1,
                          Math.floor((request.query as { page?: number }).page!)
                      )
                    : 1;

            const result = await fetchOmdbMedia(
                app,
                query,
                Math.min(limit, MAX_LIMIT),
                page
            );

            return mediaListSchema.parse(result);
        }
    );
};

/**
 * Fetches a media item from OMDb API by its ID (IMDb ID).
 * Returns `null` if the media item is not found.
 *
 * @param app - The Fastify instance (for logging and OMDb requests)
 * @param id - The IMDb ID (e.g., "tt1375666")
 * @returns A promise that resolves to a MediaItem, or `null` if not found
 * @throws {Error} If the OMDb API returns an error other than "not found"
 */
async function fetchOmdbMediaById(
    app: FastifyInstance,
    id: string
): Promise<MediaItem | null> {
    const trimmedId = id.trim();
    if (!trimmedId) {
        return null;
    }

    const detail = await requestOmdb<OmdbDetailResponse>(app, {
        i: trimmedId,
        plot: "short",
    });

    if (detail.Response === "False") {
        if (detail.Error === "Movie not found!") {
            return null;
        }

        throw new Error(detail.Error ?? "Unknown OMDb detail error");
    }

    const mapped = mapOmdbDetail(detail);
    if (!mapped) {
        throw new Error("Failed to map OMDb detail response");
    }

    return mapped;
}

/**
 * Fetches a paginated list of media items from OMDb API based on a search query.
 * Handles pagination across OMDb's page-based API to return the requested limit and page.
 * Deduplicates results by IMDb ID and handles API rate limits.
 *
 * @param app - The Fastify instance (for logging and OMDb requests)
 * @param query - The search query string
 * @param limit - Maximum number of items to return
 * @param page - Page number (1-based)
 * @returns A promise that resolves to a MediaList with items, pagination info, and hasMore flag
 */
async function fetchOmdbMedia(
    app: FastifyInstance,
    query: string,
    limit: number,
    page: number
): Promise<MediaList> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return {
            items: [],
            hasMore: false,
            nextPage: null,
        };
    }

    const offset = (page - 1) * limit;
    const startOmdbPage = Math.floor(offset / OMDB_PAGE_SIZE) + 1;
    const skipWithinFirstPage = offset % OMDB_PAGE_SIZE;

    const collected: OmdbSearchItem[] = [];
    const seenIds = new Set<string>();

    let totalResults: number | undefined;
    let reachedEnd = false;
    let currentOmdbPage = startOmdbPage;
    let isFirstPage = true;

    while (
        collected.length < limit &&
        !reachedEnd &&
        currentOmdbPage <= MAX_OMDB_PAGES
    ) {
        const searchResponse = await requestOmdb<OmdbSearchResponse>(app, {
            s: trimmedQuery,
            page: String(currentOmdbPage),
        });

        if (searchResponse.Response === "False") {
            if (searchResponse.Error === "Movie not found!") {
                return {
                    items: [],
                    hasMore: false,
                    nextPage: null,
                };
            }

            throw new Error(
                searchResponse.Error ?? "Unknown OMDb search error"
            );
        }

        if (totalResults === undefined && searchResponse.totalResults) {
            const parsedTotal = Number.parseInt(
                searchResponse.totalResults,
                10
            );
            if (!Number.isNaN(parsedTotal)) {
                totalResults = parsedTotal;
            }
        }

        if (
            isFirstPage &&
            totalResults !== undefined &&
            offset >= totalResults
        ) {
            return {
                items: [],
                hasMore: false,
                nextPage: null,
            };
        }

        const searchItems = searchResponse.Search ?? [];

        const startIndex = isFirstPage ? skipWithinFirstPage : 0;
        isFirstPage = false;

        for (let i = startIndex; i < searchItems.length; i++) {
            const candidate = searchItems[i];
            if (seenIds.has(candidate.imdbID)) {
                continue;
            }

            seenIds.add(candidate.imdbID);
            collected.push(candidate);

            if (collected.length >= limit) {
                break;
            }
        }

        if (searchItems.length < OMDB_PAGE_SIZE) {
            reachedEnd = true;
        }

        if (
            totalResults !== undefined &&
            offset + collected.length >= totalResults
        ) {
            reachedEnd = true;
        }

        currentOmdbPage += 1;
    }

    const detailPromises = collected.map(async (item) => {
        const detail = await requestOmdb<OmdbDetailResponse>(app, {
            i: item.imdbID,
            plot: "short",
        });

        if (detail.Response === "False") {
            app.log.warn(
                { imdbID: item.imdbID, error: detail.Error },
                "Failed to fetch OMDb details"
            );
            return mapSearchFallback(item);
        }

        return mapOmdbDetail(detail);
    });

    const detailed = (await Promise.all(detailPromises)).filter(
        (item): item is MediaItem => Boolean(item)
    );

    const totalCollected = offset + collected.length;
    const hasMore =
        totalResults !== undefined
            ? totalCollected < totalResults
            : collected.length === limit && !reachedEnd;

    const nextPage = hasMore ? page + 1 : null;

    return {
        items: detailed,
        hasMore,
        nextPage,
    };
}
