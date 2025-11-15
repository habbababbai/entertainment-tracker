import type { MediaItem } from "@entertainment-tracker/contracts";

import type { OmdbDetailResponse, OmdbSearchItem } from "../../types/omdb.js";

/**
 * Maps an OMDb detail response to a MediaItem.
 * Handles missing or "N/A" values by converting them to `null`.
 * Determines media type based on Type, Genre, and Country fields.
 *
 * @param detail - The OMDb detail response object
 * @returns A MediaItem object, or `null` if the response indicates "False" (not found)
 *
 * @example
 * ```ts
 * const mediaItem = mapOmdbDetail(omdbResponse);
 * if (mediaItem) {
 *   // Use the mapped media item
 * }
 * ```
 */
export function mapOmdbDetail(detail: OmdbDetailResponse): MediaItem | null {
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

/**
 * Maps an OMDb search item to a MediaItem.
 * Used as a fallback when full detail is not available.
 * Creates minimal MediaItem with available search result data.
 *
 * @param item - The OMDb search result item
 * @returns A MediaItem object with basic information from search results
 *
 * @example
 * ```ts
 * const mediaItem = mapSearchFallback(searchResultItem);
 * ```
 */
export function mapSearchFallback(item: OmdbSearchItem): MediaItem {
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

/**
 * Normalizes a string value from OMDb API.
 * Converts "N/A", empty strings, or undefined to `null`.
 *
 * @param value - The value to normalize
 * @returns The normalized string value, or `null` if value is missing or "N/A"
 */
function normalizeValue(value?: string): string | null {
    if (!value || value === "N/A") {
        return null;
    }
    return value;
}

/**
 * Normalizes a URL value from OMDb API.
 * Converts "N/A", empty strings, or undefined to `null`.
 *
 * @param url - The URL to normalize
 * @returns The normalized URL string, or `null` if URL is missing or "N/A"
 */
function normalizeUrl(url?: string): string | null {
    if (!url || url === "N/A") {
        return null;
    }
    return url;
}

/**
 * Parses an optional integer string from OMDb API.
 * Handles "N/A", empty strings, or invalid numbers by returning `null`.
 *
 * @param input - The string to parse as an integer
 * @returns The parsed integer, or `null` if input is missing, "N/A", or invalid
 */
function parseOptionalInteger(input?: string): number | null {
    if (!input || input === "N/A") {
        return null;
    }

    const parsed = Number.parseInt(input, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Derives a release date from OMDb API fields.
 * Prioritizes the "Released" field if available and valid, otherwise falls back to "Year".
 * If Year is provided, creates a date for January 1st of that year.
 *
 * @param released - The "Released" date string from OMDb (e.g., "16 Jul 2010")
 * @param year - The "Year" string from OMDb (e.g., "2010")
 * @returns An ISO 8601 date string, or `null` if both inputs are invalid or missing
 */
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

/**
 * Maps OMDb media type information to internal MediaType enum.
 * Determines if content is MOVIE, TV, or ANIME based on Type, Genre, and Country.
 * ANIME is detected if genre contains "anime" or (genre contains "animation" AND country includes "japan").
 *
 * @param type - The "Type" field from OMDb (e.g., "movie", "series", "episode")
 * @param genre - The "Genre" field from OMDb (optional)
 * @param country - The "Country" field from OMDb (optional)
 * @returns The mapped MediaType ("MOVIE", "TV", or "ANIME")
 */
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
