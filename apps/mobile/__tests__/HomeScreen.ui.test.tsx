import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
}

function renderHomeScreen() {
    const queryClient = createQueryClient();
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

describe("HomeScreen UI", () => {
    it("renders media results when the query succeeds", async () => {
        fetchMediaMock.mockResolvedValueOnce(
            createMediaList([
                createMediaItem({
                    id: "media-101",
                    title: "Princess Mononoke",
                }),
            ])
        );

        const { findByText, queryClient } = renderHomeScreen();

        expect(await findByText("Entertainment Tracker")).toBeTruthy();
        expect(await findByText("Princess Mononoke")).toBeTruthy();

        queryClient.clear();
    });

    it("shows an error message when the query fails", async () => {
        fetchMediaMock.mockRejectedValueOnce(new Error("Network unavailable"));

        const { findByText, queryClient } = renderHomeScreen();

        expect(await findByText("Unable to load media.")).toBeTruthy();
        expect(await findByText("Network unavailable")).toBeTruthy();

        queryClient.clear();
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

        const { getByPlaceholderText, getByText, queryClient } =
            renderHomeScreen();

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

        queryClient.clear();
    });
});
