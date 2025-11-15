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
import { isTokenExpiringSoon } from "./utils/jwt";

const API_BASE_URL = resolveApiBaseUrl();

function getAccessToken(): string | null {
    return useAuthStore.getState().accessToken;
}

class NetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NetworkError";
    }
}

class AuthenticationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthenticationError";
    }
}

async function extractErrorMessage(
    response: Response
): Promise<string | undefined> {
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
                return errorData.message;
            }
        } else {
            const text = await response.text();
            return text.trim() || undefined;
        }
    } catch {
        return undefined;
    }
}

async function parseResponse<T>(
    response: Response,
    parser: (value: unknown) => T
): Promise<T> {
    if (!response.ok) {
        const message = await extractErrorMessage(response);
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

async function authenticatedFetch<T>(
    path: string,
    options: RequestInit,
    parser: (value: unknown) => T,
    retryOn401 = true,
    maxRetries = 1
): Promise<T> {
    const url = new URL(path, API_BASE_URL).toString();

    let accessToken = getAccessToken();
    if (!accessToken) {
        throw new AuthenticationError("Not authenticated");
    }

    const hasBody = options.body !== undefined && options.body !== null;
    let headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers as Record<string, string> | undefined),
    };

    if (hasBody) {
        headers["Content-Type"] = "application/json";
    }

    if (isTokenExpiringSoon(accessToken, 60) && retryOn401) {
        await useAuthStore.getState().refreshAccessToken();
        accessToken = getAccessToken();
        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }
    }

    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= maxRetries) {
        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (
                response.status === 401 &&
                retryOn401 &&
                retryCount < maxRetries
            ) {
                const refreshSuccess = await useAuthStore
                    .getState()
                    .refreshAccessToken();

                if (!refreshSuccess) {
                    throw new AuthenticationError("Authentication required");
                }

                const newAccessToken = getAccessToken();
                if (!newAccessToken) {
                    throw new AuthenticationError("Authentication required");
                }

                headers = {
                    ...headers,
                    Authorization: `Bearer ${newAccessToken}`,
                };

                retryCount++;
                continue;
            }

            return parseResponse(response, parser);
        } catch (error) {
            if (error instanceof AuthenticationError) {
                throw error;
            }

            if (error instanceof TypeError && error.message.includes("fetch")) {
                throw new NetworkError(
                    error.message || "Network request failed"
                );
            }

            lastError =
                error instanceof Error ? error : new Error(String(error));

            if (retryCount >= maxRetries) {
                throw lastError;
            }

            retryCount++;
        }
    }

    throw lastError || new Error("Request failed");
}

export type {
    WatchEntry,
    WatchlistResponse,
    AddWatchlistRequest,
    UpdateWatchlistRequest,
    WatchStatus,
} from "@entertainment-tracker/contracts";

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
