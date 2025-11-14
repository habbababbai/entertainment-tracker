import {
    watchEntrySchema,
    watchlistResponseSchema,
    addWatchlistRequestSchema,
    updateWatchlistRequestSchema,
    type WatchEntry,
    type WatchlistResponse,
    type AddWatchlistRequest,
    type UpdateWatchlistRequest,
} from "@entertainment-tracker/contracts";
import { resolveApiBaseUrl } from "./media";
import { useAuthStore } from "./store/auth";

const API_BASE_URL = resolveApiBaseUrl();

function getAccessToken(): string | null {
    return useAuthStore.getState().accessToken;
}

// Re-export types for convenience
export type {
    WatchEntry,
    WatchlistResponse,
    AddWatchlistRequest,
    UpdateWatchlistRequest,
} from "@entertainment-tracker/contracts";

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

    const hasBody = options.body !== undefined && options.body !== null;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers as Record<string, string> | undefined),
    };

    if (hasBody) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url.toString(), {
        ...options,
        headers,
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
    return watchEntrySchema.parse(value);
}

function parseWatchlistResponse(value: unknown): WatchlistResponse {
    return watchlistResponseSchema.parse(value);
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

    const validatedRequest = addWatchlistRequestSchema.parse({
        mediaItemId: trimmedId,
    });

    return authenticatedFetch(
        "/api/v1/watchlist",
        {
            method: "POST",
            body: JSON.stringify(validatedRequest),
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

    const validatedRequest = updateWatchlistRequestSchema.parse(request);

    return authenticatedFetch(
        `/api/v1/watchlist/${encodeURIComponent(trimmedId)}`,
        {
            method: "PATCH",
            body: JSON.stringify(validatedRequest),
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
