import type { MediaItem } from "@entertainment-tracker/contracts";

import type { OmdbDetailResponse, OmdbSearchItem } from "../../types/omdb.js";

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
