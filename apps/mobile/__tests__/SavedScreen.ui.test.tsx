import React from "react";
import {
    act,
    cleanup,
    fireEvent,
    render,
    waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { notifyManager } from "@tanstack/query-core";
import { SafeAreaProvider } from "react-native-safe-area-context";

import SavedTab from "../app/(tabs)/saved";
import type { WatchEntry, WatchlistResponse } from "../lib/watchlist";
import { fetchWatchlist } from "../lib/watchlist";
import { useAuthStore } from "../lib/store/auth";

const mockPush = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    clear: jest.fn(),
    getAllKeys: jest.fn(),
    multiRemove: jest.fn(),
}));

jest.mock("expo-router", () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock("../lib/watchlist", () => {
    const actual = jest.requireActual("../lib/watchlist");
    return {
        ...actual,
        fetchWatchlist: jest.fn(),
    };
});

jest.mock("../lib/store/auth", () => {
    const actual = jest.requireActual("../lib/store/auth");
    return {
        ...actual,
        useAuthStore: jest.fn(),
    };
});

const fetchWatchlistMock = fetchWatchlist as jest.MockedFunction<
    typeof fetchWatchlist
>;
const useAuthStoreMock = useAuthStore as jest.MockedFunction<
    typeof useAuthStore
>;

const activeClients = new Set<QueryClient>();

const originalScheduler = notifyManager.schedule;

beforeAll(() => {
    jest.useFakeTimers();
    notifyManager.setScheduler((callback) => {
        callback();
    });
});

afterAll(() => {
    notifyManager.setScheduler(originalScheduler);
    jest.useRealTimers();
});

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
        },
    });
}

function renderSavedTab() {
    const queryClient = createQueryClient();
    activeClients.add(queryClient);
    const utils = render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 0, right: 0, bottom: 0, left: 0 },
            }}
        >
            <QueryClientProvider client={queryClient}>
                <SavedTab />
            </QueryClientProvider>
        </SafeAreaProvider>
    );

    act(() => {
        jest.runOnlyPendingTimers();
    });

    return { ...utils, queryClient };
}

function createWatchlistResponse(items: WatchEntry[] = []): WatchlistResponse {
    return { items };
}

function createWatchEntry(overrides: Partial<WatchEntry> = {}): WatchEntry {
    return {
        id: "entry-1",
        userId: "user-1",
        mediaItemId: "media-1",
        status: "PLANNED",
        rating: null,
        notes: null,
        lastWatchedAt: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        mediaItem: {
            id: "media-1",
            externalId: "tt0000001",
            source: "omdb",
            title: "Test Movie",
            description: "Test description",
            posterUrl: null,
            backdropUrl: null,
            mediaType: "MOVIE",
            totalSeasons: null,
            totalEpisodes: null,
            releaseDate: "2024-01-01T00:00:00.000Z",
        },
        ...overrides,
    };
}

beforeEach(() => {
    fetchWatchlistMock.mockReset();
    mockPush.mockReset();
    useAuthStoreMock.mockImplementation((selector: any) => {
        if (typeof selector === "function") {
            return selector({ isAuthenticated: true });
        }
        return true;
    });
});

afterEach(async () => {
    cleanup();
    await Promise.all(
        Array.from(activeClients).map((client) =>
            client.cancelQueries({ exact: false })
        )
    );
    activeClients.forEach((client) => {
        client.clear();
        client.getMutationCache().clear();
        client.getQueryCache().clear();
    });
    activeClients.clear();
});

describe("SavedScreen UI", () => {
    it("shows login screen when user is not authenticated", () => {
        useAuthStoreMock.mockImplementation((selector: any) => {
            if (typeof selector === "function") {
                return selector({ isAuthenticated: false });
            }
            return false;
        });

        const { getByText } = renderSavedTab();

        expect(getByText("Sign In")).toBeTruthy();
        expect(fetchWatchlistMock).not.toHaveBeenCalled();
    });

    it("shows loading state when fetching watchlist", async () => {
        fetchWatchlistMock.mockImplementation(
            () =>
                new Promise((resolve) => {
                    setTimeout(() => resolve(createWatchlistResponse()), 100);
                })
        );

        const { getByText } = renderSavedTab();

        expect(getByText("Loading watchlist…")).toBeTruthy();
        expect(fetchWatchlistMock).toHaveBeenCalledTimes(1);
    });

    it("displays empty state when watchlist is empty", async () => {
        fetchWatchlistMock.mockResolvedValue(createWatchlistResponse([]));

        const { findByText } = renderSavedTab();

        expect(await findByText("No saved items yet.")).toBeTruthy();
    });

    it("displays watchlist items when available", async () => {
        const entry1 = createWatchEntry({
            id: "entry-1",
            mediaItemId: "media-1",
            status: "PLANNED",
            mediaItem: {
                id: "media-1",
                externalId: "tt0000001",
                source: "omdb",
                title: "Movie One",
                description: "Description one",
                posterUrl: null,
                backdropUrl: null,
                mediaType: "MOVIE",
                totalSeasons: null,
                totalEpisodes: null,
                releaseDate: "2024-01-01T00:00:00.000Z",
            },
        });

        const entry2 = createWatchEntry({
            id: "entry-2",
            mediaItemId: "media-2",
            status: "WATCHING",
            rating: 8,
            notes: "Great movie!",
            mediaItem: {
                id: "media-2",
                externalId: "tt0000002",
                source: "omdb",
                title: "Movie Two",
                description: "Description two",
                posterUrl: null,
                backdropUrl: null,
                mediaType: "TV",
                totalSeasons: null,
                totalEpisodes: null,
                releaseDate: "2024-01-02T00:00:00.000Z",
            },
        });

        fetchWatchlistMock.mockResolvedValue(
            createWatchlistResponse([entry1, entry2])
        );

        const { findByText, getByText, getByTestId } = renderSavedTab();

        expect(await findByText("Movie One")).toBeTruthy();
        expect(getByText("Movie Two")).toBeTruthy();
        expect(getByText("PLANNED")).toBeTruthy();
        expect(getByText("WATCHING")).toBeTruthy();
        expect(getByText(/8\/10/)).toBeTruthy();
        expect(getByText("Great movie!")).toBeTruthy();

        expect(getByTestId("watchlist-card-entry-1")).toBeTruthy();
        expect(getByTestId("watchlist-card-entry-2")).toBeTruthy();
    });

    it("displays status and rating correctly", async () => {
        const entry = createWatchEntry({
            status: "COMPLETED",
            rating: 9,
            notes: "Amazing!",
        });

        fetchWatchlistMock.mockResolvedValue(createWatchlistResponse([entry]));

        const { findByText, getByText } = renderSavedTab();

        expect(await findByText("Test Movie")).toBeTruthy();
        expect(getByText("COMPLETED")).toBeTruthy();
        expect(getByText(/9\/10/)).toBeTruthy();
        expect(getByText("Amazing!")).toBeTruthy();
    });

    it("displays N/A when rating is null", async () => {
        const entry = createWatchEntry({
            status: "PLANNED",
            rating: null,
        });

        fetchWatchlistMock.mockResolvedValue(createWatchlistResponse([entry]));

        const { findByText, getByText } = renderSavedTab();

        expect(await findByText("Test Movie")).toBeTruthy();
        expect(getByText(/N\/A/)).toBeTruthy();
    });

    it("shows error state when fetch fails", async () => {
        const error = new Error("Network error");
        fetchWatchlistMock.mockRejectedValue(error);

        const { findByText, getByText } = renderSavedTab();

        expect(await findByText("Unable to load watchlist.")).toBeTruthy();
        expect(getByText("Network error")).toBeTruthy();
        expect(getByText("Pull to retry.")).toBeTruthy();
    });

    it("allows pull to refresh", async () => {
        fetchWatchlistMock.mockResolvedValue(createWatchlistResponse([]));

        const { getByText, UNSAFE_getByType } = renderSavedTab();

        await waitFor(() => {
            expect(getByText("No saved items yet.")).toBeTruthy();
        });

        const { RefreshControl } = require("react-native");
        const refreshControl = UNSAFE_getByType(RefreshControl);

        act(() => {
            fireEvent(refreshControl, "refresh");
        });

        expect(fetchWatchlistMock).toHaveBeenCalledTimes(2);
    });

    it("navigates to media details on card press", async () => {
        const entry = createWatchEntry({
            mediaItem: {
                id: "media-123",
                externalId: "tt0000001",
                source: "omdb",
                title: "Test Movie",
                description: "Test description",
                posterUrl: null,
                backdropUrl: null,
                mediaType: "MOVIE",
                totalSeasons: null,
                totalEpisodes: null,
                releaseDate: "2024-01-01T00:00:00.000Z",
            },
        });

        fetchWatchlistMock.mockResolvedValue(createWatchlistResponse([entry]));

        const { findByText, getByTestId } = renderSavedTab();

        const card = await findByText("Test Movie");
        fireEvent.press(card);

        expect(mockPush).toHaveBeenCalledWith({
            pathname: "/media/[id]",
            params: { id: "tt0000001" },
        });
    });

    it("handles missing description gracefully", async () => {
        const entry = createWatchEntry({
            mediaItem: {
                id: "media-1",
                externalId: "tt0000001",
                source: "omdb",
                title: "Test Movie",
                description: null,
                posterUrl: null,
                backdropUrl: null,
                mediaType: "MOVIE",
                totalSeasons: null,
                totalEpisodes: null,
                releaseDate: null,
            },
        });

        fetchWatchlistMock.mockResolvedValue(createWatchlistResponse([entry]));

        const { findByText } = renderSavedTab();

        expect(await findByText("No description provided.")).toBeTruthy();
    });

    it("displays all status types correctly", async () => {
        const statuses = [
            "PLANNED",
            "WATCHING",
            "COMPLETED",
            "ON_HOLD",
            "DROPPED",
        ] as const;

        const entries = statuses.map((status, index) =>
            createWatchEntry({
                id: `entry-${index}`,
                status,
                mediaItem: {
                    id: `media-${index}`,
                    externalId: `tt000000${index}`,
                    source: "omdb",
                    title: `Movie ${status}`,
                    description: "Description",
                    posterUrl: null,
                    backdropUrl: null,
                    mediaType: "MOVIE",
                    totalSeasons: null,
                    totalEpisodes: null,
                    releaseDate: "2024-01-01T00:00:00.000Z",
                },
            })
        );

        fetchWatchlistMock.mockResolvedValue(createWatchlistResponse(entries));

        const { findByText, getByText } = renderSavedTab();

        for (const status of statuses) {
            expect(await findByText(status)).toBeTruthy();
            expect(getByText(`Movie ${status}`)).toBeTruthy();
        }
    });
});
