import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
    mediaListSchema,
    type MediaItem,
    mediaTypeSchema,
} from "@entertainment-tracker/contracts";

import { env } from "../../env.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
const OMDB_BASE_URL = "https://www.omdbapi.com/";
const OMDB_PAGE_SIZE = 10;

interface OmdbSearchItem {
    Title: string;
    Year?: string;
    imdbID: string;
    Type?: string;
    Poster?: string;
}

interface OmdbSearchResponse {
    Search?: OmdbSearchItem[];
    totalResults?: string;
    Response: "True" | "False";
    Error?: string;
}

interface OmdbDetailResponse extends OmdbSearchItem {
    Response: "True" | "False";
    Error?: string;
    Plot?: string;
    Released?: string;
    totalSeasons?: string;
    totalEpisodes?: string;
    Country?: string;
    Genre?: string;
    Poster?: string;
}

export const mediaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
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
                                items: {
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
                                        createdAt: { type: ["string", "null"] },
                                        updatedAt: { type: ["string", "null"] },
                                    },
                                    required: [
                                        "id",
                                        "externalId",
                                        "source",
                                        "title",
                                        "mediaType",
                                    ],
                                },
                            },
                        },
                        required: ["items"],
                    },
                },
            },
        },
        async (request) => {
            const { limit = DEFAULT_LIMIT, query } = request.query as {
                limit?: number;
                query: string;
            };

            const items = await fetchOmdbMedia(
                app,
                query,
                Math.min(limit, MAX_LIMIT)
            );

            return mediaListSchema.parse({ items });
        }
    );
};

async function fetchOmdbMedia(
    app: FastifyInstance,
    query: string,
    limit: number
): Promise<MediaItem[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return [];
    }

    const pagesNeeded = Math.max(1, Math.ceil(limit / OMDB_PAGE_SIZE));
    const collected: OmdbSearchItem[] = [];

    for (let page = 1; page <= pagesNeeded; page++) {
        const searchResponse = await requestOmdb<OmdbSearchResponse>(app, {
            s: trimmedQuery,
            page: String(page),
        });

        if (searchResponse.Response === "False") {
            if (searchResponse.Error === "Movie not found!") {
                return [];
            }

            throw new Error(
                searchResponse.Error ?? "Unknown OMDb search error"
            );
        }

        if (searchResponse.Search) {
            collected.push(...searchResponse.Search);
        }

        if (
            !searchResponse.Search ||
            searchResponse.Search.length < OMDB_PAGE_SIZE
        ) {
            break;
        }

        if (collected.length >= limit) {
            break;
        }
    }

    const limited = collected.slice(0, limit);
    const detailed = await Promise.all(
        limited.map(async (item) => {
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
        })
    );

    return detailed.filter(Boolean) as MediaItem[];
}

async function requestOmdb<T>(
    app: FastifyInstance,
    params: Record<string, string>
): Promise<T> {
    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set("apikey", env.OMDB_API_KEY);

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
        const message = await response.text();
        app.log.error(
            { status: response.status, message },
            "OMDb request failed"
        );
        throw new Error(`OMDb request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
}

function mapOmdbDetail(detail: OmdbDetailResponse): MediaItem | null {
    if (detail.Response === "False") {
        return null;
    }

    const nowIso = new Date().toISOString();
    return {
        id: detail.imdbID,
        externalId: detail.imdbID,
        source: "omdb",
        title: detail.Title,
        description: normalizeValue(detail.Plot),
        posterUrl: normalizeUrl(detail.Poster),
        backdropUrl: null,
        mediaType: mapMediaType(detail.Type, detail.Genre, detail.Country),
        totalSeasons: parseOptionalInteger(detail.totalSeasons),
        totalEpisodes: parseOptionalInteger(detail.totalEpisodes),
        releaseDate: deriveReleaseDate(detail.Released, detail.Year),
        createdAt: nowIso,
        updatedAt: nowIso,
    };
}

function mapSearchFallback(item: OmdbSearchItem): MediaItem {
    const nowIso = new Date().toISOString();
    return {
        id: item.imdbID,
        externalId: item.imdbID,
        source: "omdb",
        title: item.Title,
        description: null,
        posterUrl: normalizeUrl(item.Poster),
        backdropUrl: null,
        mediaType: mapMediaType(item.Type),
        totalSeasons: null,
        totalEpisodes: null,
        releaseDate: deriveReleaseDate(undefined, item.Year),
        createdAt: nowIso,
        updatedAt: nowIso,
    };
}

function normalizeValue(value?: string): string | null {
    if (!value || value === "N/A") {
        return null;
    }
    return value;
}

function normalizeUrl(url?: string): string | null {
    if (!url || url === "N/A") {
        return null;
    }
    return url;
}

function parseOptionalInteger(input?: string): number | null {
    if (!input || input === "N/A") {
        return null;
    }

    const parsed = Number.parseInt(input, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function deriveReleaseDate(released?: string, year?: string): string | null {
    if (released && released !== "N/A") {
        const date = new Date(released);
        if (!Number.isNaN(date.getTime())) {
            return date.toISOString();
        }
    }

    if (year && year !== "N/A") {
        const date = new Date(`${year}-01-01`);
        if (!Number.isNaN(date.getTime())) {
            return date.toISOString();
        }
    }

    return null;
}

function mapMediaType(type?: string, genre?: string, country?: string) {
    const normalizedType = (type ?? "").toLowerCase();
    if (normalizedType === "series" || normalizedType === "episode") {
        return "TV" as const;
    }

    const normalizedGenre = (genre ?? "").toLowerCase();
    const normalizedCountry = (country ?? "").toLowerCase();

    if (
        normalizedGenre.includes("anime") ||
        (normalizedGenre.includes("animation") &&
            normalizedCountry.includes("japan"))
    ) {
        return "ANIME" as const;
    }

    return "MOVIE" as const;
}
