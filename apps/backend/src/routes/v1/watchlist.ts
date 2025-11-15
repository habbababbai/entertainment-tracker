import { type FastifyInstance, type FastifyPluginAsync } from "fastify";
import type {
    AddWatchlistRequest,
    UpdateWatchlistRequest,
} from "@entertainment-tracker/contracts";

import { conflict, notFound } from "../../lib/http-errors.js";
import {
    mapOmdbDetail,
} from "../../lib/omdb/index.js";
import {
    type OmdbDetailResponse,
} from "../../types/omdb.js";
import { requestOmdb } from "../../lib/omdb/index.js";

const watchEntrySchema = {
    type: "object",
    properties: {
        id: { type: "string" },
        userId: { type: "string" },
        mediaItemId: { type: "string" },
        status: {
            type: "string",
            enum: ["PLANNED", "WATCHING", "COMPLETED", "ON_HOLD", "DROPPED"],
        },
        rating: { type: ["integer", "null"] },
        notes: { type: ["string", "null"] },
        lastWatchedAt: { type: ["string", "null"], format: "date-time" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        mediaItem: {
            type: "object",
            properties: {
                id: { type: "string" },
                externalId: { type: "string" },
                source: { type: "string" },
                title: { type: "string" },
                description: { type: ["string", "null"] },
                posterUrl: { type: ["string", "null"] },
                backdropUrl: { type: ["string", "null"] },
                mediaType: {
                    type: "string",
                    enum: ["MOVIE", "TV", "ANIME"],
                },
                totalSeasons: { type: ["integer", "null"] },
                totalEpisodes: { type: ["integer", "null"] },
                releaseDate: { type: ["string", "null"], format: "date-time" },
            },
            required: ["id", "externalId", "source", "title", "mediaType"],
        },
    },
    required: [
        "id",
        "userId",
        "mediaItemId",
        "status",
        "createdAt",
        "updatedAt",
    ],
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


type AddWatchlistBody = AddWatchlistRequest;
type UpdateWatchlistBody = UpdateWatchlistRequest;

/**
 * Resolves a media item ID by checking the database first, then fetching from OMDb if needed.
 * Accepts either an internal database ID or an external ID (IMDb ID).
 * If the media item doesn't exist in the database, fetches it from OMDb and creates/updates it.
 *
 * @param app - The Fastify instance (for database and OMDb access)
 * @param mediaItemId - Either the internal database ID or external ID (IMDb ID)
 * @returns A promise that resolves to the internal database ID
 * @throws {HttpError} If the media item is not found in OMDb
 * @throws {Error} If OMDb API returns an error
 */
async function resolveMediaItemId(
    app: FastifyInstance,
    mediaItemId: string
): Promise<string> {
    let mediaItem = await app.prisma.mediaItem.findUnique({
        where: { id: mediaItemId },
    });

    if (!mediaItem) {
        mediaItem = await app.prisma.mediaItem.findUnique({
            where: { externalId: mediaItemId },
        });
    }

    if (mediaItem) {
        return mediaItem.id;
    }

    const detail = await requestOmdb<OmdbDetailResponse>(app, {
        i: mediaItemId,
        plot: "short",
    });

    if (detail.Response === "False") {
        if (detail.Error === "Movie not found!") {
            throw notFound("Media item not found");
        }
        throw new Error(detail.Error ?? "Unknown OMDb detail error");
    }

    const mapped = mapOmdbDetail(detail);
    if (!mapped) {
        throw notFound("Media item not found");
    }

    const createdMediaItem = await app.prisma.mediaItem.upsert({
        where: { externalId: mapped.externalId },
        update: {
            title: mapped.title,
            description: mapped.description,
            posterUrl: mapped.posterUrl,
            backdropUrl: mapped.backdropUrl,
            mediaType: mapped.mediaType,
            totalSeasons: mapped.totalSeasons,
            totalEpisodes: mapped.totalEpisodes,
            releaseDate: mapped.releaseDate
                ? new Date(mapped.releaseDate)
                : null,
            updatedAt: new Date(),
        },
        create: {
            externalId: mapped.externalId,
            source: mapped.source,
            title: mapped.title,
            description: mapped.description,
            posterUrl: mapped.posterUrl,
            backdropUrl: mapped.backdropUrl,
            mediaType: mapped.mediaType,
            totalSeasons: mapped.totalSeasons,
            totalEpisodes: mapped.totalEpisodes,
            releaseDate: mapped.releaseDate
                ? new Date(mapped.releaseDate)
                : null,
        },
    });

    return createdMediaItem.id;
}

export const watchlistRoutes: FastifyPluginAsync = async (
    app: FastifyInstance
) => {
    app.post(
        "/watchlist",
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
                        mediaItemId: {
                            type: "string",
                            minLength: 1,
                        },
                    },
                    required: ["mediaItemId"],
                    additionalProperties: false,
                },
                response: {
                    201: watchEntrySchema,
                    404: errorResponseSchema,
                    409: errorResponseSchema,
                    401: errorResponseSchema,
                },
            },
        },
        async (request, reply) => {
            const { mediaItemId } = request.body as AddWatchlistBody;
            const userId = request.user.id;

            const internalMediaItemId = await resolveMediaItemId(app, mediaItemId);

            const existingEntry = await app.prisma.watchEntry.findUnique({
                where: {
                    userId_mediaItemId: {
                        userId,
                        mediaItemId: internalMediaItemId,
                    },
                },
            });

            if (existingEntry) {
                throw conflict("Item already in watchlist");
            }

            const watchEntry = await app.prisma.watchEntry.create({
                data: {
                    userId,
                    mediaItemId: internalMediaItemId,
                    status: "PLANNED",
                },
                include: {
                    mediaItem: true,
                },
            });

            reply.code(201);
            return serializeWatchEntry(watchEntry);
        }
    );

    app.delete(
        "/watchlist/:mediaItemId",
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
                params: {
                    type: "object",
                    properties: {
                        mediaItemId: {
                            type: "string",
                            minLength: 1,
                        },
                    },
                    required: ["mediaItemId"],
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
                    404: errorResponseSchema,
                    401: errorResponseSchema,
                },
            },
        },
        async (request, reply) => {
            const { mediaItemId } = request.params as { mediaItemId: string };
            const userId = request.user.id;

            const internalMediaItemId = await resolveMediaItemId(app, mediaItemId);

            const watchEntry = await app.prisma.watchEntry.findUnique({
                where: {
                    userId_mediaItemId: {
                        userId,
                        mediaItemId: internalMediaItemId,
                    },
                },
            });

            if (!watchEntry) {
                throw notFound("Item not found in watchlist");
            }

            await app.prisma.watchEntry.delete({
                where: {
                    userId_mediaItemId: {
                        userId,
                        mediaItemId: internalMediaItemId,
                    },
                },
            });

            return reply.send({
                success: true,
                message: "Item removed from watchlist",
            });
        }
    );

    app.get(
        "/watchlist",
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
                response: {
                    200: {
                        type: "object",
                        properties: {
                            items: {
                                type: "array",
                                items: watchEntrySchema,
                            },
                        },
                        required: ["items"],
                    },
                    401: errorResponseSchema,
                },
            },
        },
        async (request) => {
            const userId = request.user.id;

            const watchEntries = await app.prisma.watchEntry.findMany({
                where: {
                    userId,
                },
                include: {
                    mediaItem: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            });

            return {
                items: watchEntries.map(serializeWatchEntry),
            };
        }
    );

    app.patch(
        "/watchlist/:mediaItemId",
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
                params: {
                    type: "object",
                    properties: {
                        mediaItemId: {
                            type: "string",
                            minLength: 1,
                        },
                    },
                    required: ["mediaItemId"],
                    additionalProperties: false,
                },
                body: {
                    type: "object",
                    properties: {
                        status: {
                            type: "string",
                            enum: [
                                "PLANNED",
                                "WATCHING",
                                "COMPLETED",
                                "ON_HOLD",
                                "DROPPED",
                            ],
                        },
                        rating: {
                            type: ["integer", "null"],
                            minimum: 1,
                            maximum: 10,
                        },
                        notes: {
                            type: ["string", "null"],
                        },
                        lastWatchedAt: {
                            type: ["string", "null"],
                            format: "date-time",
                        },
                    },
                    additionalProperties: false,
                },
                response: {
                    200: watchEntrySchema,
                    400: errorResponseSchema,
                    404: errorResponseSchema,
                    401: errorResponseSchema,
                },
            },
        },
        async (request) => {
            const { mediaItemId } = request.params as { mediaItemId: string };
            const userId = request.user.id;
            const body = request.body as UpdateWatchlistBody;

            const internalMediaItemId = await resolveMediaItemId(app, mediaItemId);

            const watchEntry = await app.prisma.watchEntry.findUnique({
                where: {
                    userId_mediaItemId: {
                        userId,
                        mediaItemId: internalMediaItemId,
                    },
                },
                include: {
                    mediaItem: true,
                },
            });

            if (!watchEntry) {
                throw notFound("Item not found in watchlist");
            }

            const updateData: {
                status?:
                    | "PLANNED"
                    | "WATCHING"
                    | "COMPLETED"
                    | "ON_HOLD"
                    | "DROPPED";
                rating?: number | null;
                notes?: string | null;
                lastWatchedAt?: Date | null;
            } = {};

            if (body.status !== undefined) {
                updateData.status = body.status;
            }

            if (body.rating !== undefined) {
                updateData.rating = body.rating;
            }

            if (body.notes !== undefined) {
                updateData.notes = body.notes;
            }

            if (body.lastWatchedAt !== undefined) {
                updateData.lastWatchedAt = body.lastWatchedAt
                    ? new Date(body.lastWatchedAt)
                    : null;
            }

            if (Object.keys(updateData).length === 0) {
                return serializeWatchEntry(watchEntry);
            }

            const updatedEntry = await app.prisma.watchEntry.update({
                where: {
                    userId_mediaItemId: {
                        userId,
                        mediaItemId: internalMediaItemId,
                    },
                },
                data: updateData,
                include: {
                    mediaItem: true,
                },
            });

            return serializeWatchEntry(updatedEntry);
        }
    );

    app.get(
        "/watchlist/:mediaItemId",
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
                params: {
                    type: "object",
                    properties: {
                        mediaItemId: {
                            type: "string",
                            minLength: 1,
                        },
                    },
                    required: ["mediaItemId"],
                    additionalProperties: false,
                },
                response: {
                    200: watchEntrySchema,
                    404: errorResponseSchema,
                    401: errorResponseSchema,
                },
            },
        },
        async (request) => {
            const { mediaItemId } = request.params as { mediaItemId: string };
            const userId = request.user.id;

            const internalMediaItemId = await resolveMediaItemId(app, mediaItemId);

            const watchEntry = await app.prisma.watchEntry.findUnique({
                where: {
                    userId_mediaItemId: {
                        userId,
                        mediaItemId: internalMediaItemId,
                    },
                },
                include: {
                    mediaItem: true,
                },
            });

            if (!watchEntry) {
                throw notFound("Item not found in watchlist");
            }

            return serializeWatchEntry(watchEntry);
        }
    );
};

/**
 * Serializes a watchlist entry database object to a safe format for API responses.
 * Converts Date objects to ISO strings for proper JSON serialization.
 *
 * @param entry - The watchlist entry object from Prisma
 * @returns A serialized watchlist entry object safe for API responses
 */
function serializeWatchEntry(entry: {
    id: string;
    userId: string;
    mediaItemId: string;
    status: string;
    rating: number | null;
    notes: string | null;
    lastWatchedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    mediaItem: {
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
    };
}) {
    return {
        id: entry.id,
        userId: entry.userId,
        mediaItemId: entry.mediaItemId,
        status: entry.status,
        rating: entry.rating,
        notes: entry.notes,
        lastWatchedAt: entry.lastWatchedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        mediaItem: {
            id: entry.mediaItem.id,
            externalId: entry.mediaItem.externalId,
            source: entry.mediaItem.source,
            title: entry.mediaItem.title,
            description: entry.mediaItem.description,
            posterUrl: entry.mediaItem.posterUrl,
            backdropUrl: entry.mediaItem.backdropUrl,
            mediaType: entry.mediaItem.mediaType,
            totalSeasons: entry.mediaItem.totalSeasons,
            totalEpisodes: entry.mediaItem.totalEpisodes,
            releaseDate: entry.mediaItem.releaseDate?.toISOString() ?? null,
        },
    };
}
