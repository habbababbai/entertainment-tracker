import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EditWatchlistEntryModal from "../components/EditWatchlistEntryModal";
import type { WatchEntry } from "../lib/watchlist";
import { updateWatchlistEntry } from "../lib/watchlist";

const mockOnClose = jest.fn();
let mockUpdateWatchlistEntry: jest.MockedFunction<typeof updateWatchlistEntry>;

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

jest.mock("../lib/watchlist", () => {
    const actual = jest.requireActual("../lib/watchlist");
    return {
        ...actual,
        updateWatchlistEntry: jest.fn(),
    };
});

jest.mock("../lib/theme", () => ({
    useTheme: () => ({
        surface: "#1C1C1E",
        background: "#000000",
        textPrimary: "#FFFFFF",
        textSecondary: "#8E8E93",
        textMuted: "#636366",
        border: "#38383A",
        accent: "#007AFF",
        accentOnAccent: "#FFFFFF",
        error: "#FF3B30",
    }),
}));

jest.mock("../lib/theme/fonts", () => ({
    fontSizes: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 20,
    },
    fontWeights: {
        medium: "500",
        semiBold: "600",
    },
}));

jest.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                "common.cancel": "Cancel",
                "common.save": "Save",
                "saved.edit.status": "Status",
                "saved.edit.rating": "Rating",
            };
            return translations[key] || key;
        },
        i18n: {
            changeLanguage: jest.fn(),
        },
    }),
}));

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

function renderModal(entry: WatchEntry | null, visible = true) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <EditWatchlistEntryModal
                visible={visible}
                entry={entry}
                onClose={mockOnClose}
            />
        </QueryClientProvider>
    );
}

describe("EditWatchlistEntryModal", () => {
    beforeEach(() => {
        mockOnClose.mockClear();
        mockUpdateWatchlistEntry = updateWatchlistEntry as jest.MockedFunction<
            typeof updateWatchlistEntry
        >;
        mockUpdateWatchlistEntry.mockClear();
    });

    it("does not render when entry is null", () => {
        const { queryByText } = renderModal(null);

        expect(queryByText("Test Movie")).toBeNull();
    });

    it("does not render when visible is false", () => {
        const entry = createWatchEntry();
        const { queryByText } = renderModal(entry, false);

        expect(queryByText("Test Movie")).toBeNull();
    });

    it("displays modal with entry title", () => {
        const entry = createWatchEntry();
        const { getByText } = renderModal(entry);

        expect(getByText("Test Movie")).toBeTruthy();
    });

    it("displays current status as selected", () => {
        const entry = createWatchEntry({ status: "WATCHING" });
        const { getByText } = renderModal(entry);

        const watchingButton = getByText("WATCHING").parent;
        expect(watchingButton).toBeTruthy();
    });

    it("displays current rating", () => {
        const entry = createWatchEntry({ rating: 7 });
        const { getByText } = renderModal(entry);

        expect(getByText("7/10")).toBeTruthy();
    });

    it("allows changing status", () => {
        const entry = createWatchEntry({ status: "PLANNED" });
        const { getByText } = renderModal(entry);

        fireEvent.press(getByText("WATCHING"));

        const watchingButton = getByText("WATCHING").parent;
        expect(watchingButton).toBeTruthy();
    });

    it("allows changing rating", () => {
        const entry = createWatchEntry({ rating: null });
        const { getByTestId, getByText } = renderModal(entry);

        fireEvent.press(getByTestId("star-5"));

        expect(getByText("5/10")).toBeTruthy();
    });

    it("calls onClose when close button is pressed", () => {
        const entry = createWatchEntry();
        const { getByText } = renderModal(entry);

        fireEvent.press(getByText("✕"));

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when cancel button is pressed", () => {
        const entry = createWatchEntry();
        const { getByText } = renderModal(entry);

        fireEvent.press(getByText("Cancel"));

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("saves changes when save button is pressed", async () => {
        const entry = createWatchEntry({
            status: "PLANNED",
            rating: null,
        });
        const updatedEntry = createWatchEntry({
            status: "WATCHING",
            rating: 5,
        });

        mockUpdateWatchlistEntry.mockResolvedValue(updatedEntry);

        const { getByText, getByTestId } = renderModal(entry);

        fireEvent.press(getByText("WATCHING"));
        fireEvent.press(getByTestId("star-5"));
        fireEvent.press(getByText("Save"));

        await waitFor(() => {
            expect(mockUpdateWatchlistEntry).toHaveBeenCalledWith(
                "tt0000001",
                {
                    status: "WATCHING",
                    rating: 5,
                }
            );
        });

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    it("displays all status options", () => {
        const entry = createWatchEntry();
        const { getByText } = renderModal(entry);

        expect(getByText("PLANNED")).toBeTruthy();
        expect(getByText("WATCHING")).toBeTruthy();
        expect(getByText("COMPLETED")).toBeTruthy();
        expect(getByText("ON_HOLD")).toBeTruthy();
        expect(getByText("DROPPED")).toBeTruthy();
    });

    it("removes rating when same star is pressed again", () => {
        const entry = createWatchEntry({ rating: 5 });
        const { getByTestId, queryByText } = renderModal(entry);

        fireEvent.press(getByTestId("star-5"));

        expect(queryByText("5/10")).toBeNull();
    });

    it("shows loading state when saving", async () => {
        const entry = createWatchEntry();
        let resolvePromise: (value: WatchEntry) => void;
        const promise = new Promise<WatchEntry>((resolve) => {
            resolvePromise = resolve;
        });
        mockUpdateWatchlistEntry.mockImplementation(() => promise);

        const { getByText } = renderModal(entry);

        fireEvent.press(getByText("Save"));

        await waitFor(() => {
            const saveButton = getByText("Save");
            expect(saveButton).toBeTruthy();
        });

        if (resolvePromise!) {
            resolvePromise(entry);
        }
    });

    it("does not show rating text when rating is null", () => {
        const entry = createWatchEntry({ rating: null });
        const { queryByText } = renderModal(entry);

        expect(queryByText(/\/10/)).toBeNull();
    });

    it("initializes with entry status and rating", () => {
        const entry = createWatchEntry({
            status: "COMPLETED",
            rating: 9,
        });
        const { getByText } = renderModal(entry);

        expect(getByText("9/10")).toBeTruthy();
        expect(getByText("COMPLETED")).toBeTruthy();
    });
});

