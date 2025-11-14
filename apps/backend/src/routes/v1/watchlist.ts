import { type FastifyInstance, type FastifyPluginAsync } from "fastify";

import { conflict, notFound } from "../../lib/http-errors.js";

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

interface AddWatchlistBody {
    mediaItemId: string;
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

            const mediaItem = await app.prisma.mediaItem.findUnique({
                where: { id: mediaItemId },
            });

            if (!mediaItem) {
                throw notFound("Media item not found");
            }

            const existingEntry = await app.prisma.watchEntry.findUnique({
                where: {
                    userId_mediaItemId: {
                        userId,
                        mediaItemId,
                    },
                },
            });

            if (existingEntry) {
                throw conflict("Item already in watchlist");
            }

            const watchEntry = await app.prisma.watchEntry.create({
                data: {
                    userId,
                    mediaItemId,
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

            const watchEntry = await app.prisma.watchEntry.findUnique({
                where: {
                    userId_mediaItemId: {
                        userId,
                        mediaItemId,
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
                        mediaItemId,
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
};

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
