import { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { MediaItem as PrismaMediaItem } from "@prisma/client";
import {
    mediaListSchema,
    type MediaItem
} from "@entertainment-tracker/contracts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export const mediaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get(
        "/media",
        {
            schema: {
                querystring: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "integer",
                            minimum: 1,
                            maximum: MAX_LIMIT,
                            default: DEFAULT_LIMIT,
                        },
                    },
                    additionalProperties: false,
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            items: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        externalId: { type: "string" },
                                        source: { type: "string" },
                                        title: { type: "string" },
                                        description: { type: ["string", "null"] },
                                        posterUrl: { type: ["string", "null"] },
                                        backdropUrl: { type: ["string", "null"] },
                                        mediaType: { type: "string" },
                                        totalSeasons: { type: ["integer", "null"] },
                                        totalEpisodes: { type: ["integer", "null"] },
                                        releaseDate: { type: ["string", "null"], format: "date-time" },
                                        createdAt: { type: "string", format: "date-time" },
                                        updatedAt: { type: "string", format: "date-time" },
                                    },
                                    required: ["id", "externalId", "source", "title", "mediaType", "createdAt", "updatedAt"],
                                },
                            },
                        },
                        required: ["items"],
                    },
                },
            },
        },
        async (request) => {
            const { limit = DEFAULT_LIMIT } = request.query as { limit?: number };

            const records = await app.prisma.mediaItem.findMany({
                take: Math.min(limit, MAX_LIMIT),
                orderBy: {
                    createdAt: "desc",
                },
            });

            const items = records.map(serializeMediaItem);

            return mediaListSchema.parse({ items });
        },
    );
};

function serializeMediaItem(item: PrismaMediaItem): MediaItem {
    return {
        id: item.id,
        externalId: item.externalId,
        source: item.source,
        title: item.title,
        description: item.description ?? null,
        posterUrl: item.posterUrl ?? null,
        backdropUrl: item.backdropUrl ?? null,
        mediaType: item.mediaType,
        totalSeasons: item.totalSeasons ?? null,
        totalEpisodes: item.totalEpisodes ?? null,
        releaseDate: item.releaseDate ? item.releaseDate.toISOString() : null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
    };
}

