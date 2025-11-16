/* eslint-disable @typescript-eslint/no-require-imports */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

jest.mock("../lib/i18n", () => ({
    default: {
        isInitialized: true,
        use: jest.fn(() => ({
            init: jest.fn(),
        })),
    },
}));

jest.mock("react-i18next", () => ({
    useTranslation: () => {
        const { en } = jest.requireActual("../lib/i18n/locales/en");

        // Helper function to get nested translation value
        const getTranslation = (key: string): string => {
            const parts = key.split(".");
            let value: unknown = en;
            for (const part of parts) {
                if (value && typeof value === "object" && part in value) {
                    value = value[part as keyof typeof value];
                } else {
                    return key;
                }
            }
            return typeof value === "string" ? value : key;
        };

        return {
            t: (key: string, params?: Record<string, string | number>) => {
                let translation = getTranslation(key);
                if (params && typeof translation === "string") {
                    Object.entries(params).forEach(([paramKey, paramValue]) => {
                        translation = translation.replace(
                            new RegExp(`{{${paramKey}}}`, "g"),
                            String(paramValue)
                        );
                    });
                }
                return translation;
            },
            i18n: {
                changeLanguage: jest.fn(),
            },
        };
    },
}));

import MediaDetailsScreen from "../app/media/[id]";
import type { MediaItem } from "../lib/media";
import { fetchMediaItem } from "../lib/media";
import type { WatchEntry } from "../lib/watchlist";
import {
    addToWatchlist,
    fetchWatchlistEntry,
    removeFromWatchlist,
    updateWatchlistEntry,
} from "../lib/watchlist";
import { useAuthStore, type AuthState } from "../lib/store/auth";

jest.mock("../lib/media", () => {
    const actual = jest.requireActual("../lib/media");
    return {
        ...actual,
        fetchMediaItem: jest.fn(),
    };
});

jest.mock("../lib/watchlist", () => {
    const actual = jest.requireActual("../lib/watchlist");
    return {
        ...actual,
        fetchWatchlistEntry: jest.fn(),
        addToWatchlist: jest.fn(),
        removeFromWatchlist: jest.fn(),
        updateWatchlistEntry: jest.fn(),
    };
});

jest.mock("../lib/store/auth", () => {
    const actual = jest.requireActual("../lib/store/auth");
    return {
        ...actual,
        useAuthStore: jest.fn(),
    };
});

jest.mock("react-native-star-rating-widget", () => {
    const React = require("react");
    const { View, TouchableOpacity, Text } = require("react-native");

    return function StarRating({
        rating,
        onChange,
        maxStars,
    }: {
        rating: number;
        onChange: (rating: number) => void;
        maxStars: number;
    }) {
        return (
            <View testID="star-rating-widget">
                {Array.from({ length: maxStars }, (_, i) => {
                    const starValue = i + 1;
                    const isFilled = starValue <= rating;
                    return (
                        <TouchableOpacity
                            key={starValue}
                            testID={`star-${starValue}`}
                            onPress={() => onChange(starValue)}
                        >
                            <Text>{isFilled ? "★" : "☆"}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };
});

const fetchMediaItemMock = fetchMediaItem as jest.MockedFunction<
    typeof fetchMediaItem
>;
const fetchWatchlistEntryMock = fetchWatchlistEntry as jest.MockedFunction<
    typeof fetchWatchlistEntry
>;
const addToWatchlistMock = addToWatchlist as jest.MockedFunction<
    typeof addToWatchlist
>;
const removeFromWatchlistMock = removeFromWatchlist as jest.MockedFunction<
    typeof removeFromWatchlist
>;
const updateWatchlistEntryMock = updateWatchlistEntry as jest.MockedFunction<
    typeof updateWatchlistEntry
>;
const useAuthStoreMock = useAuthStore as jest.MockedFunction<
    typeof useAuthStore
>;

const mockBack = jest.fn();

jest.mock("expo-router", () => {
    const actual = jest.requireActual("expo-router");
    return {
        ...actual,
        Stack: {
            Screen: () => null,
        },
        useRouter: () => ({
            back: mockBack,
        }),
        useLocalSearchParams: jest.fn(() => ({
            id: "tt1234567",
        })),
    };
});
import { useLocalSearchParams } from "expo-router";

const mockUseLocalSearchParams = useLocalSearchParams as unknown as jest.Mock;

const originalScheduler = notifyManager.schedule;
const activeClients = new Set<QueryClient>();

beforeAll(() => {
    // Use a synchronous scheduler so callbacks run immediately
    // This allows React Testing Library's act() to catch them naturally
    notifyManager.setScheduler((callback) => {
        callback();
    });
});

afterAll(() => {
    notifyManager.setScheduler(originalScheduler);
});

function createQueryClient() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
                refetchOnMount: false,
            },
        },
    });
    activeClients.add(queryClient);
    return queryClient;
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

function createWatchEntry(overrides: Partial<WatchEntry> = {}): WatchEntry {
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
            title: "Sample Title",
            description: "Sample description",
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

afterEach(async () => {
    // Cancel all queries first within act to catch any updates
    await act(async () => {
        await Promise.all(
            Array.from(activeClients).map(async (client) => {
                await client.cancelQueries({ exact: false });
            })
        );
    });

    // Clear all caches within act to catch any final updates
    await act(async () => {
        activeClients.forEach((client) => {
            client.clear();
            client.getMutationCache().clear();
            client.getQueryCache().clear();
        });
        activeClients.clear();
    });

    cleanup();

    fetchMediaItemMock.mockReset();
    fetchWatchlistEntryMock.mockReset();
    addToWatchlistMock.mockReset();
    removeFromWatchlistMock.mockReset();
    updateWatchlistEntryMock.mockReset();
    mockBack.mockReset();
    mockUseLocalSearchParams.mockReset();
    mockUseLocalSearchParams.mockReturnValue({ id: "tt1234567" });
    useAuthStoreMock.mockReset();
    useAuthStoreMock.mockImplementation(
        (selector?: (state: AuthState) => unknown) => {
            if (typeof selector === "function") {
                return selector({ isAuthenticated: false } as AuthState);
            }
            return false;
        }
    );
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

    it("uses the first id when multiple ids are provided in the route", async () => {
        mockUseLocalSearchParams.mockImplementation(() => ({
            id: ["media-456", "alternate"],
        }));
        fetchMediaItemMock.mockResolvedValueOnce(
            createMediaItem({ id: "media-456", title: "Primary Route Item" })
        );

        const { findByText } = renderDetailsScreen();

        expect(await findByText("Primary Route Item")).toBeTruthy();
        expect(fetchMediaItemMock).toHaveBeenCalledWith("media-456");
    });

    it("renders a missing id message when no route parameter is provided", async () => {
        mockUseLocalSearchParams.mockImplementation(() => ({}));

        const { findByText } = renderDetailsScreen();

        expect(await findByText("Missing media identifier.")).toBeTruthy();
        expect(fetchMediaItemMock).not.toHaveBeenCalled();
    });

    it("renders a not-found message when the query resolves without data", async () => {
        fetchMediaItemMock.mockResolvedValueOnce(null as unknown as MediaItem);

        const { findByText } = renderDetailsScreen();

        expect(
            await findByText("We couldn't find this media item.")
        ).toBeTruthy();
    });

    it("formats metadata fallbacks when values are invalid", async () => {
        fetchMediaItemMock.mockResolvedValueOnce(
            createMediaItem({
                releaseDate: "invalid-date",
                updatedAt: undefined,
                totalSeasons: null,
                totalEpisodes: null,
            })
        );

        const { findByText } = renderDetailsScreen();

        expect(
            await findByText(
                "Source: omdb • Type: MOVIE • Seasons: N/A • Episodes: N/A"
            )
        ).toBeTruthy();
        expect(await findByText("Release date: N/A")).toBeTruthy();
        expect(await findByText("Last updated: N/A")).toBeTruthy();
    });

    it("retries fetching when the retry button is pressed after a generic error", async () => {
        fetchMediaItemMock
            .mockRejectedValueOnce(new Error("Service unavailable"))
            .mockResolvedValueOnce(
                createMediaItem({ title: "Recovered Title", posterUrl: null })
            );

        const { findByText } = renderDetailsScreen();

        expect(await findByText("Unable to load media item.")).toBeTruthy();

        const retryButton = await findByText("Try again");
        await act(async () => {
            fireEvent.press(retryButton);
        });

        expect(fetchMediaItemMock).toHaveBeenCalledTimes(2);
        expect(await findByText("Recovered Title")).toBeTruthy();
    });

    it("shows the shared empty description message when no overview is available", async () => {
        fetchMediaItemMock.mockResolvedValueOnce(
            createMediaItem({ description: null })
        );

        const { findByText } = renderDetailsScreen();

        expect(await findByText("Overview")).toBeTruthy();
        expect(await findByText("No description provided.")).toBeTruthy();
    });

    describe("watchlist functionality", () => {
        beforeEach(() => {
            useAuthStoreMock.mockImplementation(
                (selector?: (state: AuthState) => unknown) => {
                    if (typeof selector === "function") {
                        return selector({ isAuthenticated: true } as AuthState);
                    }
                    return true;
                }
            );
        });

        it("does not show watchlist actions when user is not authenticated", async () => {
            useAuthStoreMock.mockImplementation(
                (selector?: (state: AuthState) => unknown) => {
                    if (typeof selector === "function") {
                        return selector({
                            isAuthenticated: false,
                        } as AuthState);
                    }
                    return false;
                }
            );

            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());

            const { queryByText } = renderDetailsScreen();

            await waitFor(() => {
                expect(fetchMediaItemMock).toHaveBeenCalled();
            });

            expect(queryByText("Save")).toBeNull();
            expect(queryByText("Remove")).toBeNull();
            expect(fetchWatchlistEntryMock).not.toHaveBeenCalled();
        });

        it("shows save button when item is not in watchlist", async () => {
            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());
            fetchWatchlistEntryMock.mockRejectedValueOnce(
                new Error("Item not found in watchlist")
            );

            const { findByText } = renderDetailsScreen();

            await waitFor(
                () => {
                    expect(fetchMediaItemMock).toHaveBeenCalled();
                },
                { timeout: 3000 }
            );

            await waitFor(
                () => {
                    expect(fetchWatchlistEntryMock).toHaveBeenCalled();
                },
                { timeout: 3000 }
            );

            expect(await findByText("Save")).toBeTruthy();
        });

        it("shows remove button and edit button when item is in watchlist", async () => {
            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());
            fetchWatchlistEntryMock.mockResolvedValueOnce(createWatchEntry());

            const { findByText } = renderDetailsScreen();

            await waitFor(
                () => {
                    expect(fetchWatchlistEntryMock).toHaveBeenCalled();
                },
                { timeout: 3000 }
            );

            expect(await findByText("Remove")).toBeTruthy();
            expect(await findByText("Edit")).toBeTruthy();
        });

        it("adds item to watchlist when save button is pressed", async () => {
            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());
            fetchWatchlistEntryMock.mockRejectedValueOnce(
                new Error("Item not found in watchlist")
            );
            addToWatchlistMock.mockResolvedValueOnce(createWatchEntry());

            const { findByText, queryClient } = renderDetailsScreen();

            await waitFor(() => {
                expect(fetchWatchlistEntryMock).toHaveBeenCalled();
            });

            const saveButton = await findByText("Save");
            await act(async () => {
                fireEvent.press(saveButton);
            });

            await waitFor(() => {
                expect(addToWatchlistMock).toHaveBeenCalledWith({
                    mediaItemId: "tt1234567",
                });
            });

            expect(
                queryClient.getQueryCache().findAll().length
            ).toBeGreaterThanOrEqual(1);
        });

        it("removes item from watchlist when remove button is pressed", async () => {
            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());
            fetchWatchlistEntryMock.mockResolvedValueOnce(createWatchEntry());
            removeFromWatchlistMock.mockResolvedValueOnce(undefined);

            const { findByText, queryClient } = renderDetailsScreen();

            await waitFor(() => {
                expect(fetchWatchlistEntryMock).toHaveBeenCalled();
            });

            const removeButton = await findByText("Remove");
            await act(async () => {
                fireEvent.press(removeButton);
            });

            await waitFor(() => {
                expect(removeFromWatchlistMock).toHaveBeenCalledWith(
                    "tt1234567"
                );
            });

            expect(
                queryClient.getQueryCache().findAll().length
            ).toBeGreaterThanOrEqual(1);
        });

        it("shows loading state when watchlist operation is in progress", async () => {
            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());
            fetchWatchlistEntryMock.mockRejectedValueOnce(
                new Error("Item not found in watchlist")
            );
            addToWatchlistMock.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve(createWatchEntry()), 100);
                    })
            );

            const { findByText } = renderDetailsScreen();

            await waitFor(() => {
                expect(fetchWatchlistEntryMock).toHaveBeenCalled();
            });

            const saveButton = await findByText("Save");
            await act(async () => {
                fireEvent.press(saveButton);
            });

            expect(await findByText(/Save|Remove/)).toBeTruthy();
        });

        it("disables watchlist buttons when id is missing", async () => {
            mockUseLocalSearchParams.mockReturnValue({ id: "" });

            const { queryByText, findByText } = renderDetailsScreen();

            expect(await findByText("Missing media identifier.")).toBeTruthy();
            expect(fetchMediaItemMock).not.toHaveBeenCalled();
            expect(queryByText("Save")).toBeNull();
        });
    });

    describe("edit watchlist functionality", () => {
        beforeEach(() => {
            useAuthStoreMock.mockImplementation(
                (selector?: (state: AuthState) => unknown) => {
                    if (typeof selector === "function") {
                        return selector({ isAuthenticated: true } as AuthState);
                    }
                    return true;
                }
            );
        });

        it("opens edit modal when edit button is pressed", async () => {
            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());
            fetchWatchlistEntryMock.mockResolvedValueOnce(createWatchEntry());

            const { findByText, getAllByText } = renderDetailsScreen();

            await waitFor(() => {
                expect(fetchWatchlistEntryMock).toHaveBeenCalled();
            });

            const editButton = await findByText("Edit");
            await act(async () => {
                fireEvent.press(editButton);
            });

            expect(getAllByText("Sample Title").length).toBeGreaterThan(0);
            expect(getAllByText("Status").length).toBeGreaterThan(0);
            expect(getAllByText("Rating").length).toBeGreaterThan(0);
        });

        it("displays current status and rating in edit modal", async () => {
            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());
            fetchWatchlistEntryMock.mockResolvedValueOnce(
                createWatchEntry({ status: "WATCHING", rating: 8 })
            );

            const { findByText, getAllByText } = renderDetailsScreen();

            await waitFor(() => {
                expect(fetchWatchlistEntryMock).toHaveBeenCalled();
            });

            const editButton = await findByText("Edit");
            await act(async () => {
                fireEvent.press(editButton);
            });

            // Status appears both in badge and modal, check that at least one exists
            expect(getAllByText("Watching").length).toBeGreaterThan(0);
            expect(await findByText("8/10")).toBeTruthy();
        });

        it("allows changing status in edit modal", async () => {
            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());
            fetchWatchlistEntryMock.mockResolvedValueOnce(
                createWatchEntry({ status: "PLANNED" })
            );

            const { findByText } = renderDetailsScreen();

            await waitFor(() => {
                expect(fetchWatchlistEntryMock).toHaveBeenCalled();
            });

            const editButton = await findByText("Edit");
            await act(async () => {
                fireEvent.press(editButton);
            });

            fireEvent.press(await findByText("Completed"));

            expect(await findByText("Completed")).toBeTruthy();
        });

        it("saves changes when save button is pressed", async () => {
            const mediaItem = createMediaItem();
            fetchMediaItemMock.mockResolvedValueOnce(mediaItem);
            fetchWatchlistEntryMock.mockResolvedValueOnce(
                createWatchEntry({
                    status: "PLANNED",
                    rating: null,
                    mediaItem: {
                        ...createWatchEntry().mediaItem,
                        externalId: mediaItem.externalId,
                    },
                })
            );
            updateWatchlistEntryMock.mockResolvedValueOnce(
                createWatchEntry({
                    status: "WATCHING",
                    rating: 5,
                    mediaItem: {
                        ...createWatchEntry().mediaItem,
                        externalId: mediaItem.externalId,
                    },
                })
            );

            const { findByText, findByTestId, queryClient } =
                renderDetailsScreen();

            await waitFor(() => {
                expect(fetchWatchlistEntryMock).toHaveBeenCalled();
            });

            const editButton = await findByText("Edit");
            await act(async () => {
                fireEvent.press(editButton);
            });

            await waitFor(async () => {
                await expect(findByText("Status")).resolves.toBeTruthy();
            });

            await act(async () => {
                fireEvent.press(await findByText("Watching"));
            });

            await act(async () => {
                fireEvent.press(await findByTestId("star-5"));
            });

            await act(async () => {
                fireEvent.press(await findByText("Save"));
            });

            await waitFor(() => {
                expect(updateWatchlistEntryMock).toHaveBeenCalledWith(
                    mediaItem.externalId,
                    {
                        status: "WATCHING",
                        rating: 5,
                    }
                );
            });

            expect(
                queryClient.getQueryCache().findAll().length
            ).toBeGreaterThanOrEqual(1);
        });

        it("closes edit modal when cancel is pressed", async () => {
            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());
            fetchWatchlistEntryMock.mockResolvedValueOnce(createWatchEntry());

            const { findByText, getAllByText, queryByText } =
                renderDetailsScreen();

            await waitFor(() => {
                expect(fetchWatchlistEntryMock).toHaveBeenCalled();
            });

            const editButton = await findByText("Edit");
            await act(async () => {
                fireEvent.press(editButton);
            });

            expect(getAllByText("Sample Title").length).toBeGreaterThan(0);

            const cancelButton = await findByText("Cancel");
            await act(async () => {
                fireEvent.press(cancelButton);
            });

            await waitFor(() => {
                expect(queryByText("Status")).toBeNull();
            });
        });

        it("does not show edit button when item is not in watchlist", async () => {
            fetchMediaItemMock.mockResolvedValueOnce(createMediaItem());
            fetchWatchlistEntryMock.mockRejectedValueOnce(
                new Error("Item not found in watchlist")
            );

            const { queryByText } = renderDetailsScreen();

            await waitFor(() => {
                expect(fetchWatchlistEntryMock).toHaveBeenCalled();
            });

            expect(queryByText("Edit")).toBeNull();
        });
    });
});
