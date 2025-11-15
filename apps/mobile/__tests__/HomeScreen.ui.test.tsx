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

import HomeScreen from "../app/(tabs)/home";
import type { MediaItem, MediaList } from "../lib/media";
import { fetchMedia } from "../lib/media";
import { useHomeStore } from "../lib/store/home";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiRemove: jest.fn(() => Promise.resolve()),
}));

jest.mock("../lib/media", () => {
    const actual = jest.requireActual("../lib/media");
    return {
        ...actual,
        fetchMedia: jest.fn(),
    };
});

const fetchMediaMock = fetchMedia as jest.MockedFunction<typeof fetchMedia>;
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

function renderHomeScreen() {
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
                <HomeScreen />
            </QueryClientProvider>
        </SafeAreaProvider>
    );

    act(() => {
        jest.runOnlyPendingTimers();
    });

    return { ...utils, queryClient };
}

function createMediaList(items: MediaItem[]): MediaList {
    return {
        items,
        hasMore: false,
        nextPage: null,
    };
}

function createMediaItem(overrides: Partial<MediaItem> = {}): MediaItem {
    return {
        id: "media-1",
        externalId: "tt0000001",
        source: "OMDB",
        title: "Sample Title",
        description: "Sample description",
        posterUrl: null,
        backdropUrl: null,
        mediaType: "MOVIE",
        totalSeasons: null,
        totalEpisodes: null,
        releaseDate: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        ...overrides,
    };
}

beforeEach(() => {
    fetchMediaMock.mockReset();
    mockPush.mockReset();
    act(() => {
        useHomeStore.getState().setSubmittedSearch("chainsaw man");
        useHomeStore.getState().setScrollOffset(0);
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

describe("HomeScreen UI", () => {
    it("shows a prompt when no search has been submitted", async () => {
        act(() => {
            useHomeStore.getState().setSubmittedSearch("");
        });

        const { findByText } = renderHomeScreen();

        expect(
            await findByText("Start typing to search OMDb titles.")
        ).toBeTruthy();
        expect(fetchMediaMock).not.toHaveBeenCalled();
    });

    it("renders media results with fallback copy when fields are missing", async () => {
        fetchMediaMock.mockResolvedValueOnce(
            createMediaList([
                createMediaItem({
                    id: "media-101",
                    title: "Princess Mononoke",
                    description: undefined,
                    releaseDate: null,
                    updatedAt: "invalid-date",
                }),
            ])
        );

        const { findByText, getByText } = renderHomeScreen();

        expect(await findByText("Entertainment Tracker")).toBeTruthy();
        expect(await findByText("Princess Mononoke")).toBeTruthy();
        expect(getByText("No description provided.")).toBeTruthy();
        expect(
            getByText("Source: OMDB • Released: N/A • Updated: N/A")
        ).toBeTruthy();
    });

    it("navigates to the item details screen when a card is pressed", async () => {
        fetchMediaMock.mockResolvedValueOnce(
            createMediaList([
                createMediaItem({
                    id: "media-701",
                    title: "Spirited Away",
                }),
            ])
        );

        const { findByTestId } = renderHomeScreen();

        const card = await findByTestId("media-card-media-701");
        await act(async () => {
            fireEvent.press(card);
        });

        expect(mockPush).toHaveBeenCalledWith({
            pathname: "/media/[id]",
            params: { id: "media-701" },
        });
    });

    it("shows an error message when the query fails", async () => {
        fetchMediaMock.mockRejectedValueOnce(new Error("Network unavailable"));

        const { findByText, getByTestId } = renderHomeScreen();

        expect(await findByText("Unable to load media.")).toBeTruthy();
        expect(await findByText("Network unavailable")).toBeTruthy();
        expect(getByTestId("media-error-details").props.children).toBe(
            "Network unavailable"
        );
    });

    it("omits error details when the query fails without a message", async () => {
        fetchMediaMock.mockRejectedValueOnce(new Error(""));

        const { findByText, queryByTestId } = renderHomeScreen();

        expect(await findByText("Unable to load media.")).toBeTruthy();
        expect(queryByTestId("media-error-details")).toBeNull();
    });

    it("submits a trimmed search term when Enter is pressed", async () => {
        fetchMediaMock
            .mockResolvedValueOnce(
                createMediaList([
                    createMediaItem({ id: "media-202", title: "Chainsaw Man" }),
                ])
            )
            .mockResolvedValueOnce(
                createMediaList([
                    createMediaItem({ id: "media-303", title: "Naruto" }),
                ])
            );

        const { getByPlaceholderText } = renderHomeScreen();

        await waitFor(() => expect(fetchMediaMock).toHaveBeenCalledTimes(1));

        const input = getByPlaceholderText("Search OMDb (e.g. Spirited Away)");
        fireEvent.changeText(input, "  Naruto  ");
        fireEvent(input, "onSubmitEditing");

        await waitFor(() =>
            expect(fetchMediaMock).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    query: "Naruto",
                    limit: 15,
                    page: 1,
                })
            )
        );
    });

    it("shows an empty-state message when no media items are returned", async () => {
        fetchMediaMock.mockResolvedValueOnce(createMediaList([]));

        const { findByText } = renderHomeScreen();

        expect(await findByText("No media found.")).toBeTruthy();
    });

    it("fetches the next page when the list end is reached and more pages exist", async () => {
        fetchMediaMock
            .mockResolvedValueOnce({
                ...createMediaList([
                    createMediaItem({ id: "media-401", title: "Mob Psycho" }),
                ]),
                hasMore: true,
                nextPage: "2" as unknown as number,
            })
            .mockResolvedValueOnce(
                createMediaList([
                    createMediaItem({
                        id: "media-402",
                        title: "Mob Psycho II",
                    }),
                ])
            );

        const { getByTestId, findByText } = renderHomeScreen();

        await findByText("Mob Psycho");

        const list = getByTestId("media-list");
        await act(async () => {
            fireEvent(list, "onEndReached");
        });

        await waitFor(() => expect(fetchMediaMock).toHaveBeenCalledTimes(2));
        const [, secondCall] = fetchMediaMock.mock.calls;
        expect(secondCall?.[0]?.page).toBe(2);
    });

    it("shows a footer spinner while fetching the next page", async () => {
        let resolveSecond: (value: MediaList) => void;
        const secondPromise = new Promise<MediaList>((resolve) => {
            resolveSecond = resolve;
        });

        fetchMediaMock
            .mockResolvedValueOnce({
                ...createMediaList([
                    createMediaItem({ id: "media-701", title: "Mob Psycho" }),
                ]),
                hasMore: true,
                nextPage: 2,
            })
            .mockImplementationOnce(() => secondPromise);

        const { getByTestId, findByText, queryByTestId } = renderHomeScreen();

        await findByText("Mob Psycho");

        const list = getByTestId("media-list");
        await act(async () => {
            fireEvent(list, "onEndReached");
        });

        await waitFor(() =>
            expect(getByTestId("media-list-footer")).toBeTruthy()
        );

        act(() =>
            resolveSecond!(
                createMediaList([
                    createMediaItem({
                        id: "media-702",
                        title: "Mob Psycho Finale",
                    }),
                ])
            )
        );

        await waitFor(() =>
            expect(queryByTestId("media-list-footer")).toBeNull()
        );
    });

    it("refetches results when the list is pulled to refresh", async () => {
        fetchMediaMock
            .mockResolvedValueOnce(
                createMediaList([
                    createMediaItem({ id: "media-501", title: "Bleach" }),
                ])
            )
            .mockResolvedValueOnce(
                createMediaList([
                    createMediaItem({ id: "media-502", title: "Bleach TYBW" }),
                ])
            );

        const { getByTestId, findByText } = renderHomeScreen();

        await findByText("Bleach");

        const list = getByTestId("media-list");
        const refreshControl = list.props.refreshControl;
        if (refreshControl?.props?.onRefresh) {
            await act(async () => {
                refreshControl.props.onRefresh();
            });
        }

        await waitFor(() => expect(fetchMediaMock).toHaveBeenCalledTimes(2));
        const [, secondCall] = fetchMediaMock.mock.calls;
        expect(secondCall?.[0]?.page).toBe(1);
    });

    it("does not submit when the search input is only whitespace", async () => {
        fetchMediaMock.mockResolvedValueOnce(
            createMediaList([
                createMediaItem({ id: "media-601", title: "Initial Result" }),
            ])
        );

        const { getByPlaceholderText, findByText } = renderHomeScreen();

        await findByText("Initial Result");

        fetchMediaMock.mockClear();

        const input = getByPlaceholderText("Search OMDb (e.g. Spirited Away)");
        fireEvent.changeText(input, "   ");

        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => expect(fetchMediaMock).not.toHaveBeenCalled());
    });
});

it("disables pull-to-refresh when no search has been submitted", async () => {
    act(() => {
        useHomeStore.getState().setSubmittedSearch("");
    });

    const { getByTestId } = renderHomeScreen();

    const list = getByTestId("media-list");
    expect(list.props.refreshControl.props.enabled).toBe(false);
});

it("falls back to the first page when the next page value is not numeric", async () => {
    fetchMediaMock
        .mockResolvedValueOnce({
            ...createMediaList([
                createMediaItem({ id: "media-801", title: "Fallback Alpha" }),
            ]),
            hasMore: true,
            nextPage: "" as unknown as number,
        })
        .mockResolvedValueOnce(
            createMediaList([
                createMediaItem({ id: "media-802", title: "Fallback Beta" }),
            ])
        );

    const { getByTestId, findByText } = renderHomeScreen();

    await findByText("Fallback Alpha");

    const list = getByTestId("media-list");
    await act(async () => {
        fireEvent(list, "onEndReached");
    });

    await waitFor(() => expect(fetchMediaMock).toHaveBeenCalledTimes(2));
    const [, secondCall] = fetchMediaMock.mock.calls;
    expect(secondCall?.[0]?.page).toBe(1);
});

it("restores previous search term when screen mounts", async () => {
    act(() => {
        useHomeStore.getState().setSubmittedSearch("persisted search");
    });

    fetchMediaMock.mockResolvedValueOnce(
        createMediaList([
            createMediaItem({
                id: "media-persist",
                title: "Persisted Result",
            }),
        ])
    );

    const { findByText } = renderHomeScreen();

    await waitFor(() => {
        expect(fetchMediaMock).toHaveBeenCalledWith(
            expect.objectContaining({
                query: "persisted search",
            })
        );
    });

    await findByText("Persisted Result");
});

it("restores scroll position when screen mounts with persisted offset", async () => {
    fetchMediaMock.mockResolvedValueOnce(
        createMediaList([
            createMediaItem({ id: "media-1", title: "Item 1" }),
            createMediaItem({ id: "media-2", title: "Item 2" }),
            createMediaItem({ id: "media-3", title: "Item 3" }),
        ])
    );

    act(() => {
        useHomeStore.getState().setScrollOffset(100);
    });

    const { getByTestId } = renderHomeScreen();

    await waitFor(() => expect(fetchMediaMock).toHaveBeenCalled());

    const list = getByTestId("media-list");
    expect(list).toBeTruthy();
});

it("persists search term when submitting a new search", async () => {
    fetchMediaMock
        .mockResolvedValueOnce(
            createMediaList([
                createMediaItem({ id: "media-1", title: "First Search" }),
            ])
        )
        .mockResolvedValueOnce(
            createMediaList([
                createMediaItem({ id: "media-2", title: "Second Search" }),
            ])
        );

    const { getByPlaceholderText, findByText } = renderHomeScreen();

    await findByText("First Search");

    const input = getByPlaceholderText("Search OMDb (e.g. Spirited Away)");
    fireEvent.changeText(input, "new search term");

    act(() => {
        jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
        expect(useHomeStore.getState().submittedSearch).toBe("new search term");
    });

    await waitFor(() => {
        expect(fetchMediaMock).toHaveBeenCalledWith(
            expect.objectContaining({
                query: "new search term",
            })
        );
    });
});
