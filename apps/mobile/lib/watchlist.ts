import { resolveApiBaseUrl } from "./media";
import { useAuthStore } from "./store/auth";

const API_BASE_URL = resolveApiBaseUrl();

function getAccessToken(): string | null {
    return useAuthStore.getState().accessToken;
}

export type WatchStatus =
    | "PLANNED"
    | "WATCHING"
    | "COMPLETED"
    | "ON_HOLD"
    | "DROPPED";

export interface WatchEntry {
    id: string;
    userId: string;
    mediaItemId: string;
    status: WatchStatus;
    rating: number | null;
    notes: string | null;
    lastWatchedAt: string | null;
    createdAt: string;
    updatedAt: string;
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
        releaseDate: string | null;
    };
}

export interface WatchlistResponse {
    items: WatchEntry[];
}

export interface AddWatchlistRequest {
    mediaItemId: string;
}

export interface UpdateWatchlistRequest {
    status?: WatchStatus;
    rating?: number | null;
    notes?: string | null;
    lastWatchedAt?: string | null;
}

async function authenticatedFetch<T>(
    path: string,
    options: RequestInit,
    parser: (value: unknown) => T
): Promise<T> {
    const accessToken = getAccessToken();

    if (!accessToken) {
        throw new Error("Not authenticated");
    }

    const url = new URL(path, API_BASE_URL);

    const response = await fetch(url.toString(), {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...options.headers,
        },
    });

    if (response.status === 401) {
        throw new Error("Authentication required");
    }

    if (!response.ok) {
        let message: string | undefined;
        try {
            const contentType = response.headers.get("content-type");
            if (contentType?.includes("application/json")) {
                const errorData = await response.json();
                if (
                    typeof errorData === "object" &&
                    errorData !== null &&
                    "message" in errorData &&
                    typeof errorData.message === "string"
                ) {
                    message = errorData.message;
                }
            } else {
                const text = await response.text();
                message = text.trim() || undefined;
            }
        } catch {
            message = undefined;
        }

        throw new Error(
            message || `Request failed with status ${response.status}`
        );
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        throw new Error("Response payload is not valid JSON.");
    }

    try {
        return parser(payload);
    } catch (error) {
        const detailSource =
            (error as { message?: unknown } | null | undefined)?.message ??
            error ??
            "Unknown parser error";

        throw new Error(`Malformed response: ${String(detailSource)}`);
    }
}

function parseWatchEntry(value: unknown): WatchEntry {
    if (
        typeof value !== "object" ||
        value === null ||
        typeof (value as { id?: unknown }).id !== "string" ||
        typeof (value as { userId?: unknown }).userId !== "string" ||
        typeof (value as { mediaItemId?: unknown }).mediaItemId !== "string" ||
        typeof (value as { status?: unknown }).status !== "string" ||
        typeof (value as { createdAt?: unknown }).createdAt !== "string" ||
        typeof (value as { updatedAt?: unknown }).updatedAt !== "string" ||
        typeof (value as { mediaItem?: unknown }).mediaItem !== "object" ||
        (value as { mediaItem?: unknown }).mediaItem === null
    ) {
        throw new Error("Invalid watch entry structure");
    }

    const entry = value as WatchEntry;
    return entry;
}

function parseWatchlistResponse(value: unknown): WatchlistResponse {
    if (
        typeof value !== "object" ||
        value === null ||
        !Array.isArray((value as { items?: unknown }).items)
    ) {
        throw new Error("Invalid watchlist response structure");
    }

    const items = (value as { items: unknown[] }).items.map(parseWatchEntry);
    return { items };
}

export async function fetchWatchlist(): Promise<WatchlistResponse> {
    return authenticatedFetch(
        "/api/v1/watchlist",
        {
            method: "GET",
        },
        parseWatchlistResponse
    );
}

export async function fetchWatchlistEntry(
    mediaItemId: string
): Promise<WatchEntry> {
    const trimmedId = mediaItemId.trim();

    if (!trimmedId) {
        throw new Error("Media item ID cannot be empty.");
    }

    return authenticatedFetch(
        `/api/v1/watchlist/${encodeURIComponent(trimmedId)}`,
        {
            method: "GET",
        },
        parseWatchEntry
    );
}

export async function addToWatchlist(
    request: AddWatchlistRequest
): Promise<WatchEntry> {
    const trimmedId = request.mediaItemId.trim();

    if (!trimmedId) {
        throw new Error("Media item ID cannot be empty.");
    }

    return authenticatedFetch(
        "/api/v1/watchlist",
        {
            method: "POST",
            body: JSON.stringify({ mediaItemId: trimmedId }),
        },
        parseWatchEntry
    );
}

export async function updateWatchlistEntry(
    mediaItemId: string,
    request: UpdateWatchlistRequest
): Promise<WatchEntry> {
    const trimmedId = mediaItemId.trim();

    if (!trimmedId) {
        throw new Error("Media item ID cannot be empty.");
    }

    return authenticatedFetch(
        `/api/v1/watchlist/${encodeURIComponent(trimmedId)}`,
        {
            method: "PATCH",
            body: JSON.stringify(request),
        },
        parseWatchEntry
    );
}

export async function removeFromWatchlist(mediaItemId: string): Promise<void> {
    const trimmedId = mediaItemId.trim();

    if (!trimmedId) {
        throw new Error("Media item ID cannot be empty.");
    }

    await authenticatedFetch(
        `/api/v1/watchlist/${encodeURIComponent(trimmedId)}`,
        {
            method: "DELETE",
        },
        (value: unknown) => {
            if (
                typeof value !== "object" ||
                value === null ||
                typeof (value as { success?: unknown }).success !== "boolean"
            ) {
                throw new Error("Invalid delete response");
            }

            if (!(value as { success: boolean }).success) {
                throw new Error("Failed to remove item from watchlist");
            }
        }
    );
}
