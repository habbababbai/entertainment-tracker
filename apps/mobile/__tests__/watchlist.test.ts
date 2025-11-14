import type {
    WatchEntry,
    WatchlistResponse,
    AddWatchlistRequest,
    UpdateWatchlistRequest,
} from "../lib/watchlist";

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();
let originalApiUrl: string | undefined;

function buildWatchEntry(overrides: Partial<WatchEntry> = {}): WatchEntry {
    return {
        id: "entry-123",
        userId: "user-123",
        mediaItemId: "media-123",
        status: "PLANNED",
        rating: null,
        notes: null,
        lastWatchedAt: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        mediaItem: {
            id: "media-123",
            externalId: "tt0000001",
            source: "omdb",
            title: "Test Movie",
            description: "Test description",
            posterUrl: "https://example.com/poster.jpg",
            backdropUrl: "https://example.com/backdrop.jpg",
            mediaType: "MOVIE",
            totalSeasons: null,
            totalEpisodes: null,
            releaseDate: "2024-01-01T00:00:00.000Z",
        },
        ...overrides,
    };
}

function buildWatchlistResponse(
    items: WatchEntry[] = [buildWatchEntry()]
): WatchlistResponse {
    return { items };
}

jest.mock("../lib/store/auth", () => ({
    useAuthStore: {
        getState: jest.fn(() => ({
            accessToken: "test-access-token",
        })),
    },
}));

async function loadModule(accessToken: string | null = "test-access-token") {
    jest.resetModules();
    const authModule = jest.requireMock("../lib/store/auth");
    authModule.useAuthStore = {
        getState: jest.fn(() => ({
            accessToken,
        })),
    };

    return jest.requireActual<typeof import("../lib/watchlist")>(
        "../lib/watchlist"
    );
}

beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
});

afterEach(() => {
    if (originalApiUrl === undefined) {
        delete process.env.EXPO_PUBLIC_API_URL;
    } else {
        process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    }
    jest.clearAllMocks();
});

afterAll(() => {
    if (originalFetch) {
        globalThis.fetch = originalFetch;
    } else {
        delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
});

describe("watchlist helpers", () => {
    describe("fetchWatchlist", () => {
        it("fetches watchlist and returns parsed response", async () => {
            const { fetchWatchlist } = await loadModule();
            const response = buildWatchlistResponse();

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => response,
            });

            const result = await fetchWatchlist();

            expect(result).toEqual(response);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const [requestedUrl, options] = fetchMock.mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(requestedUrl).toBe(
                "https://api.example.test/api/v1/watchlist"
            );
            expect(options?.method).toBe("GET");
            expect(options?.headers).toMatchObject({
                "Content-Type": "application/json",
                Authorization: "Bearer test-access-token",
            });
        });

        it("throws error when not authenticated", async () => {
            const { fetchWatchlist } = await loadModule(null);

            await expect(fetchWatchlist()).rejects.toThrow("Not authenticated");
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("throws error when API returns non-OK status", async () => {
            const { fetchWatchlist } = await loadModule();

            fetchMock.mockResolvedValue({
                ok: false,
                status: 500,
                headers: {
                    get: () => "application/json",
                },
                json: async () => ({
                    statusCode: 500,
                    error: "Internal Server Error",
                    message: "Database error",
                }),
            });

            await expect(fetchWatchlist()).rejects.toThrow("Database error");
        });

        it("throws error on 401 with proper message", async () => {
            const { fetchWatchlist } = await loadModule();

            fetchMock.mockResolvedValue({
                ok: false,
                status: 401,
                headers: {
                    get: () => "application/json",
                },
                json: async () => ({
                    statusCode: 401,
                    error: "Unauthorized",
                    message: "Authentication required",
                }),
            });

            await expect(fetchWatchlist()).rejects.toThrow(
                "Authentication required"
            );
        });
    });

    describe("fetchWatchlistEntry", () => {
        it("fetches specific watchlist entry", async () => {
            const { fetchWatchlistEntry } = await loadModule();
            const response = buildWatchEntry();

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => response,
            });

            const result = await fetchWatchlistEntry("media-123");

            expect(result).toEqual(response);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const [requestedUrl] = fetchMock.mock.calls[0] as [string];
            expect(requestedUrl).toBe(
                "https://api.example.test/api/v1/watchlist/media-123"
            );
        });

        it("trims media item ID", async () => {
            const { fetchWatchlistEntry } = await loadModule();
            const response = buildWatchEntry();

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => response,
            });

            await fetchWatchlistEntry("  media-123  ");

            const [requestedUrl] = fetchMock.mock.calls[0] as [string];
            expect(requestedUrl).toBe(
                "https://api.example.test/api/v1/watchlist/media-123"
            );
        });

        it("throws error when media item ID is empty", async () => {
            const { fetchWatchlistEntry } = await loadModule();

            await expect(fetchWatchlistEntry("")).rejects.toThrow(
                "Media item ID cannot be empty"
            );
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("addToWatchlist", () => {
        it("adds item to watchlist", async () => {
            const { addToWatchlist } = await loadModule();
            const response = buildWatchEntry();
            const request: AddWatchlistRequest = { mediaItemId: "media-123" };

            fetchMock.mockResolvedValue({
                ok: true,
                status: 201,
                json: async () => response,
            });

            const result = await addToWatchlist(request);

            expect(result).toEqual(response);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const [requestedUrl, options] = fetchMock.mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(requestedUrl).toBe(
                "https://api.example.test/api/v1/watchlist"
            );
            expect(options?.method).toBe("POST");
            expect(options?.body).toBe(
                JSON.stringify({ mediaItemId: "media-123" })
            );
        });

        it("trims media item ID", async () => {
            const { addToWatchlist } = await loadModule();
            const response = buildWatchEntry();

            fetchMock.mockResolvedValue({
                ok: true,
                status: 201,
                json: async () => response,
            });

            await addToWatchlist({ mediaItemId: "  media-123  " });

            const [, options] = fetchMock.mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(options?.body).toBe(
                JSON.stringify({ mediaItemId: "media-123" })
            );
        });

        it("throws error when media item ID is empty", async () => {
            const { addToWatchlist } = await loadModule();

            await expect(addToWatchlist({ mediaItemId: "" })).rejects.toThrow(
                "Media item ID cannot be empty"
            );
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("updateWatchlistEntry", () => {
        it("updates watchlist entry status", async () => {
            const { updateWatchlistEntry } = await loadModule();
            const response = buildWatchEntry({ status: "WATCHING" });
            const request: UpdateWatchlistRequest = { status: "WATCHING" };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => response,
            });

            const result = await updateWatchlistEntry("media-123", request);

            expect(result).toEqual(response);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const [requestedUrl, options] = fetchMock.mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(requestedUrl).toBe(
                "https://api.example.test/api/v1/watchlist/media-123"
            );
            expect(options?.method).toBe("PATCH");
            expect(options?.body).toBe(JSON.stringify({ status: "WATCHING" }));
        });

        it("updates rating", async () => {
            const { updateWatchlistEntry } = await loadModule();
            const response = buildWatchEntry({ rating: 8 });
            const request: UpdateWatchlistRequest = { rating: 8 };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => response,
            });

            const result = await updateWatchlistEntry("media-123", request);

            expect(result.rating).toBe(8);
            const [, options] = fetchMock.mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(options?.body).toBe(JSON.stringify({ rating: 8 }));
        });

        it("removes rating when set to null", async () => {
            const { updateWatchlistEntry } = await loadModule();
            const response = buildWatchEntry({ rating: null });
            const request: UpdateWatchlistRequest = { rating: null };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => response,
            });

            await updateWatchlistEntry("media-123", request);

            const [, options] = fetchMock.mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(options?.body).toBe(JSON.stringify({ rating: null }));
        });

        it("updates multiple fields at once", async () => {
            const { updateWatchlistEntry } = await loadModule();
            const response = buildWatchEntry({
                status: "COMPLETED",
                rating: 9,
                notes: "Great movie!",
                lastWatchedAt: "2024-01-15T00:00:00.000Z",
            });
            const request: UpdateWatchlistRequest = {
                status: "COMPLETED",
                rating: 9,
                notes: "Great movie!",
                lastWatchedAt: "2024-01-15T00:00:00.000Z",
            };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => response,
            });

            await updateWatchlistEntry("media-123", request);

            const [, options] = fetchMock.mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(options?.body).toBe(JSON.stringify(request));
        });

        it("throws error when media item ID is empty", async () => {
            const { updateWatchlistEntry } = await loadModule();

            await expect(
                updateWatchlistEntry("", { status: "WATCHING" })
            ).rejects.toThrow("Media item ID cannot be empty");
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("removeFromWatchlist", () => {
        it("removes item from watchlist", async () => {
            const { removeFromWatchlist } = await loadModule();

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ success: true }),
            });

            await removeFromWatchlist("media-123");

            expect(fetchMock).toHaveBeenCalledTimes(1);

            const [requestedUrl, options] = fetchMock.mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(requestedUrl).toBe(
                "https://api.example.test/api/v1/watchlist/media-123"
            );
            expect(options?.method).toBe("DELETE");
        });

        it("throws error when delete response indicates failure", async () => {
            const { removeFromWatchlist } = await loadModule();

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ success: false }),
            });

            await expect(removeFromWatchlist("media-123")).rejects.toThrow(
                "Failed to remove item from watchlist"
            );
        });

        it("throws error when media item ID is empty", async () => {
            const { removeFromWatchlist } = await loadModule();

            await expect(removeFromWatchlist("")).rejects.toThrow(
                "Media item ID cannot be empty"
            );
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("error handling", () => {
        it("handles invalid JSON response", async () => {
            const { fetchWatchlist } = await loadModule();

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => {
                    throw new Error("Invalid JSON");
                },
            });

            await expect(fetchWatchlist()).rejects.toThrow(
                "Response payload is not valid JSON"
            );
        });

        it("handles malformed watchlist response", async () => {
            const { fetchWatchlist } = await loadModule();

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ invalid: "structure" }),
            });

            await expect(fetchWatchlist()).rejects.toThrow(
                "Invalid watchlist response structure"
            );
        });

        it("handles malformed watch entry structure", async () => {
            const { fetchWatchlistEntry } = await loadModule();

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => ({ invalid: "entry" }),
            });

            await expect(fetchWatchlistEntry("media-123")).rejects.toThrow(
                "Invalid watch entry structure"
            );
        });

        it("surfaces error message from API when available", async () => {
            const { fetchWatchlist } = await loadModule();

            fetchMock.mockResolvedValue({
                ok: false,
                status: 404,
                headers: {
                    get: () => "application/json",
                },
                json: async () => ({
                    statusCode: 404,
                    error: "Not Found",
                    message: "Item not found in watchlist",
                }),
            });

            await expect(fetchWatchlist()).rejects.toThrow(
                "Item not found in watchlist"
            );
        });

        it("falls back to status code when no message available", async () => {
            const { fetchWatchlist } = await loadModule();

            fetchMock.mockResolvedValue({
                ok: false,
                status: 500,
                headers: {
                    get: () => null,
                },
                text: async () => "",
            });

            await expect(fetchWatchlist()).rejects.toThrow(
                "Request failed with status 500"
            );
        });
    });
});
