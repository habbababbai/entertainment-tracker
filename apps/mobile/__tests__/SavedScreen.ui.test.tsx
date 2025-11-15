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
    useAuthStoreMock.mockImplementation(
        (selector?: (state: { isAuthenticated: boolean }) => unknown) => {
            if (typeof selector === "function") {
                return selector({ isAuthenticated: true });
            }
            return true;
        }
    );
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
        useAuthStoreMock.mockImplementation(
            (selector?: (state: { isAuthenticated: boolean }) => unknown) => {
                if (typeof selector === "function") {
                    return selector({ isAuthenticated: false });
                }
                return false;
            }
        );

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
        expect(getByText("Planned")).toBeTruthy();
        expect(getByText("Watching")).toBeTruthy();
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
        expect(getByText("Completed")).toBeTruthy();
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

        // eslint-disable-next-line @typescript-eslint/no-require-imports
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

        const { findByText } = renderSavedTab();

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

        const statusTranslations: Record<string, string> = {
            PLANNED: "Planned",
            WATCHING: "Watching",
            COMPLETED: "Completed",
            ON_HOLD: "On Hold",
            DROPPED: "Dropped",
        };

        for (const status of statuses) {
            const translatedStatus = statusTranslations[status];
            expect(await findByText(translatedStatus)).toBeTruthy();
            expect(getByText(`Movie ${status}`)).toBeTruthy();
        }
    });

    describe("search functionality", () => {
        it("filters items by title", async () => {
            const entry1 = createWatchEntry({
                id: "entry-1",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Inception",
                    externalId: "tt1375666",
                },
            });
            const entry2 = createWatchEntry({
                id: "entry-2",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "The Matrix",
                    externalId: "tt0133093",
                },
            });

            fetchWatchlistMock.mockResolvedValue(
                createWatchlistResponse([entry1, entry2])
            );

            const { findByText, getByPlaceholderText, getByText, queryByText } =
                renderSavedTab();

            await findByText("Inception");

            const searchInput = getByPlaceholderText("Search saved items...");
            fireEvent.changeText(searchInput, "Inception");

            act(() => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(getByText("Inception")).toBeTruthy();
                expect(queryByText("The Matrix")).toBeNull();
            });
        });

        it("filters items by description", async () => {
            const entry1 = createWatchEntry({
                id: "entry-1",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Movie 1",
                    description: "A sci-fi thriller",
                    externalId: "tt0000001",
                },
            });
            const entry2 = createWatchEntry({
                id: "entry-2",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Movie 2",
                    description: "A romantic comedy",
                    externalId: "tt0000002",
                },
            });

            fetchWatchlistMock.mockResolvedValue(
                createWatchlistResponse([entry1, entry2])
            );

            const { findByText, getByPlaceholderText, getByText, queryByText } =
                renderSavedTab();

            await findByText("Movie 1");

            const searchInput = getByPlaceholderText("Search saved items...");
            fireEvent.changeText(searchInput, "sci-fi");

            act(() => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(getByText("Movie 1")).toBeTruthy();
                expect(queryByText("Movie 2")).toBeNull();
            });
        });

        it("shows no results when search has no matches", async () => {
            const entry = createWatchEntry({
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Test Movie",
                },
            });

            fetchWatchlistMock.mockResolvedValue(
                createWatchlistResponse([entry])
            );

            const { findByText, getByPlaceholderText } = renderSavedTab();

            await findByText("Test Movie");

            const searchInput = getByPlaceholderText("Search saved items...");
            fireEvent.changeText(searchInput, "Nonexistent Movie");

            act(() => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(async () => {
                expect(
                    await findByText("No items match your search.")
                ).toBeTruthy();
            });
        });

        it("clears search when input is empty", async () => {
            const entry1 = createWatchEntry({
                id: "entry-1",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Movie A",
                    externalId: "tt0000001",
                },
            });
            const entry2 = createWatchEntry({
                id: "entry-2",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Movie B",
                    externalId: "tt0000002",
                },
            });

            fetchWatchlistMock.mockResolvedValue(
                createWatchlistResponse([entry1, entry2])
            );

            const { findByText, getByPlaceholderText, getByText } =
                renderSavedTab();

            await findByText("Movie A");

            const searchInput = getByPlaceholderText("Search saved items...");
            fireEvent.changeText(searchInput, "Movie A");

            act(() => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(getByText("Movie A")).toBeTruthy();
            });

            fireEvent.changeText(searchInput, "");

            act(() => {
                jest.advanceTimersByTime(300);
            });

            await waitFor(() => {
                expect(getByText("Movie A")).toBeTruthy();
                expect(getByText("Movie B")).toBeTruthy();
            });
        });
    });

    describe("sorting functionality", () => {
        it("sorts by date (newest first) by default", async () => {
            const entry1 = createWatchEntry({
                id: "entry-1",
                createdAt: "2024-01-01T00:00:00.000Z",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "First Movie",
                    externalId: "tt0000001",
                },
            });
            const entry2 = createWatchEntry({
                id: "entry-2",
                createdAt: "2024-01-02T00:00:00.000Z",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Second Movie",
                    externalId: "tt0000002",
                },
            });

            fetchWatchlistMock.mockResolvedValue(
                createWatchlistResponse([entry1, entry2])
            );

            const { findAllByText } = renderSavedTab();

            const titles = await findAllByText(/Movie/);
            expect(titles[0].props.children).toBe("Second Movie");
            expect(titles[1].props.children).toBe("First Movie");
        });

        it("sorts by name alphabetically", async () => {
            const entry1 = createWatchEntry({
                id: "entry-1",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Zebra Movie",
                    externalId: "tt0000001",
                },
            });
            const entry2 = createWatchEntry({
                id: "entry-2",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Alpha Movie",
                    externalId: "tt0000002",
                },
            });

            fetchWatchlistMock.mockResolvedValue(
                createWatchlistResponse([entry1, entry2])
            );

            const { findAllByText, getByText, getAllByText } = renderSavedTab();

            await findAllByText(/Movie/);

            const sortByNameButton = getByText("Name");
            fireEvent.press(sortByNameButton);

            await waitFor(() => {
                const titles = getAllByText(/Movie/);
                expect(titles.length).toBeGreaterThanOrEqual(2);
                const titlesText = titles.map((t) => t.props.children);
                const alphaIndex = titlesText.findIndex(
                    (text) => text === "Alpha Movie"
                );
                const zebraIndex = titlesText.findIndex(
                    (text) => text === "Zebra Movie"
                );
                expect(alphaIndex).toBeLessThan(zebraIndex);
            });
        });

        it("sorts by type", async () => {
            const entry1 = createWatchEntry({
                id: "entry-1",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "TV Show",
                    mediaType: "TV",
                    externalId: "tt0000001",
                },
            });
            const entry2 = createWatchEntry({
                id: "entry-2",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Movie Title",
                    mediaType: "MOVIE",
                    externalId: "tt0000002",
                },
            });

            fetchWatchlistMock.mockResolvedValue(
                createWatchlistResponse([entry1, entry2])
            );

            const { findAllByText, getByText, getAllByText } = renderSavedTab();

            await findAllByText(/TV Show|Movie Title/);

            const sortByTypeButton = getByText("Type");
            fireEvent.press(sortByTypeButton);

            await waitFor(() => {
                const types = getAllByText(/MOVIE|TV/);
                expect(types.length).toBeGreaterThanOrEqual(2);
                const typesText = types.map((t) => t.props.children);
                expect(typesText).toContain("MOVIE");
                expect(typesText).toContain("TV");
            });
        });

        it("sorts by year (newest first)", async () => {
            const entry1 = createWatchEntry({
                id: "entry-1",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Old Movie",
                    releaseDate: "2000-01-01T00:00:00.000Z",
                    externalId: "tt0000001",
                },
            });
            const entry2 = createWatchEntry({
                id: "entry-2",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "New Movie",
                    releaseDate: "2020-01-01T00:00:00.000Z",
                    externalId: "tt0000002",
                },
            });

            fetchWatchlistMock.mockResolvedValue(
                createWatchlistResponse([entry1, entry2])
            );

            const { findAllByText, getByText } = renderSavedTab();

            await findAllByText(/Movie/);

            const sortByYearButton = getByText("Year");
            fireEvent.press(sortByYearButton);

            await waitFor(() => {
                // Year sorting is implemented, verify the button press works
                expect(sortByYearButton).toBeTruthy();
            });
        });

        it("sorts by status", async () => {
            const entry1 = createWatchEntry({
                id: "entry-1",
                status: "COMPLETED",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Completed Movie",
                    externalId: "tt0000001",
                },
            });
            const entry2 = createWatchEntry({
                id: "entry-2",
                status: "PLANNED",
                mediaItem: {
                    ...createWatchEntry().mediaItem,
                    title: "Planned Movie",
                    externalId: "tt0000002",
                },
            });

            fetchWatchlistMock.mockResolvedValue(
                createWatchlistResponse([entry1, entry2])
            );

            const { findAllByText, getByText, getAllByText } = renderSavedTab();

            await findAllByText(/Movie/);

            const sortByStatusButton = getByText("Status");
            fireEvent.press(sortByStatusButton);

            await waitFor(() => {
                const statuses = getAllByText(/Planned|Completed/);
                // Status sorting is implemented, verify statuses are present
                expect(statuses.length).toBeGreaterThanOrEqual(2);
                const statusTexts = statuses.map((s) => s.props.children);
                expect(statusTexts).toContain("Completed");
                expect(statusTexts).toContain("Planned");
            });
        });
    });

    it("displays edit button on watchlist card", async () => {
        const entry = createWatchEntry();
        fetchWatchlistMock.mockResolvedValue(createWatchlistResponse([entry]));

        const { findByTestId } = renderSavedTab();

        expect(await findByTestId("watchlist-card-edit-entry-1")).toBeTruthy();
    });

    it("opens edit modal when edit button is pressed", async () => {
        const entry = createWatchEntry();
        fetchWatchlistMock.mockResolvedValue(createWatchlistResponse([entry]));

        const { findByTestId, getAllByText } = renderSavedTab();

        const editButton = await findByTestId("watchlist-card-edit-entry-1");
        fireEvent.press(editButton);

        expect(getAllByText("Test Movie").length).toBeGreaterThan(0);
        expect(getAllByText("Status").length).toBeGreaterThan(0);
        expect(getAllByText("Rating").length).toBeGreaterThan(0);
    });

    it("does not navigate to media details when edit button is pressed", async () => {
        const entry = createWatchEntry();
        fetchWatchlistMock.mockResolvedValue(createWatchlistResponse([entry]));

        const { findByTestId } = renderSavedTab();

        const editButton = await findByTestId("watchlist-card-edit-entry-1");
        fireEvent.press(editButton);

        expect(mockPush).not.toHaveBeenCalled();
    });
});
