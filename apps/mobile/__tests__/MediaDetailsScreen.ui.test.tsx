import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { notifyManager } from "@tanstack/query-core";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MediaDetailsScreen from "../app/media/[id]";
import type { MediaItem } from "../lib/media";
import { fetchMediaItem } from "../lib/media";

jest.mock("../lib/media", () => {
    const actual = jest.requireActual("../lib/media");
    return {
        ...actual,
        fetchMediaItem: jest.fn(),
    };
});

const fetchMediaItemMock = fetchMediaItem as jest.MockedFunction<
    typeof fetchMediaItem
>;

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
    Stack: {
        Screen: () => null,
    },
    useRouter: () => ({
        back: mockBack,
    }),
    useLocalSearchParams: jest.fn(() => ({
        id: "media-123",
    })),
}));

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

function renderDetailsScreen() {
    const queryClient = createQueryClient();
    const utils = render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 0, right: 0, bottom: 0, left: 0 },
            }}
        >
            <QueryClientProvider client={queryClient}>
                <MediaDetailsScreen />
            </QueryClientProvider>
        </SafeAreaProvider>
    );

    return { ...utils, queryClient };
}

function createMediaItem(overrides: Partial<MediaItem> = {}): MediaItem {
    return {
        id: "media-123",
        externalId: "tt1234567",
        source: "omdb",
        title: "Sample Title",
        description: "Sample description",
        posterUrl: "https://example.com/poster.jpg",
        backdropUrl: null,
        mediaType: "MOVIE",
        totalSeasons: 2,
        totalEpisodes: 24,
        releaseDate: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        ...overrides,
    };
}

afterEach(async () => {
    cleanup();
    fetchMediaItemMock.mockReset();
    mockBack.mockReset();
});

describe("MediaDetailsScreen", () => {
    it("renders the media item details when data loads", async () => {
        fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());

        const { findByText, findByLabelText } = renderDetailsScreen();

        expect(await findByText("Sample Title")).toBeTruthy();
        expect(
            await findByText(
                "Source: omdb • Type: MOVIE • Seasons: 2 • Episodes: 24"
            )
        ).toBeTruthy();
        expect(await findByText("Overview")).toBeTruthy();
        expect(await findByLabelText("Sample Title poster")).toBeTruthy();
    });

    it("shows a not found message when the item cannot be loaded", async () => {
        fetchMediaItemMock.mockRejectedValueOnce(
            new Error("Media item not found.")
        );

        const { findByText } = renderDetailsScreen();

        expect(await findByText("Unable to load media item.")).toBeTruthy();
        expect(
            await findByText("We couldn't find this media item.")
        ).toBeTruthy();
    });

    it("allows navigating back via the back button", async () => {
        fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());

        const { findByText } = renderDetailsScreen();

        const backButton = await findByText("Back");
        fireEvent.press(backButton);
        expect(mockBack).toHaveBeenCalled();
    });

    it("shows a poster fallback when no image is available", async () => {
        fetchMediaItemMock.mockResolvedValueOnce(
            createMediaItem({ posterUrl: null })
        );

        const { findByText, queryByLabelText } = renderDetailsScreen();

        expect(await findByText("Poster not available.")).toBeTruthy();
        expect(queryByLabelText("Sample Title poster")).toBeNull();
    });
});
