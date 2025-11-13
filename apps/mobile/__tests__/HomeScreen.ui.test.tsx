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

import HomeScreen from "../app/index";
import type { MediaItem, MediaList } from "../lib/media";
import { fetchMedia } from "../lib/media";

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
    notifyManager.setScheduler((callback) => {
        callback();
    });
});

afterAll(() => {
    notifyManager.setScheduler(originalScheduler);
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

    it("shows an error message when the query fails", async () => {
        fetchMediaMock.mockRejectedValueOnce(new Error("Network unavailable"));

        const { findByText } = renderHomeScreen();

        expect(await findByText("Unable to load media.")).toBeTruthy();
        expect(await findByText("Network unavailable")).toBeTruthy();
    });

    it("submits a trimmed search term when the button is pressed", async () => {
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

        const { getByPlaceholderText, getByText } = renderHomeScreen();

        await waitFor(() => expect(fetchMediaMock).toHaveBeenCalledTimes(1));

        const input = getByPlaceholderText("Search OMDb (e.g. Spirited Away)");
        fireEvent.changeText(input, "  Naruto  ");
        fireEvent.press(getByText("Search"));

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
                nextPage: 2,
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

        const { getByPlaceholderText, getByText, findByText } =
            renderHomeScreen();

        await findByText("Initial Result");

        fetchMediaMock.mockClear();

        const input = getByPlaceholderText("Search OMDb (e.g. Spirited Away)");
        await act(async () => {
            fireEvent.changeText(input, "   ");
            fireEvent.press(getByText("Search"));
        });

        await waitFor(() => expect(fetchMediaMock).not.toHaveBeenCalled());
    });
});
