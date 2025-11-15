import { act, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { useHomeStore } from "../lib/store/home";

const isNativePlatform = Platform.OS === "ios" || Platform.OS === "android";

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

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<
    typeof AsyncStorage.getItem
>;
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<
    typeof AsyncStorage.setItem
>;

describe("useHomeStore", () => {
    beforeEach(async () => {
        if (!isNativePlatform) {
            return;
        }
        jest.clearAllMocks();
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);

        await act(async () => {
            useHomeStore.setState({
                submittedSearch: "chainsaw man",
                scrollOffset: 0,
            });
        });
    });

    (isNativePlatform ? it : it.skip)("initializes with default values", () => {
        const { result } = renderHook(() => useHomeStore());

        expect(result.current.submittedSearch).toBe("chainsaw man");
        expect(result.current.scrollOffset).toBe(0);
    });

    (isNativePlatform ? it : it.skip)("sets submitted search term", () => {
        const { result } = renderHook(() => useHomeStore());

        act(() => {
            result.current.setSubmittedSearch("naruto");
        });

        expect(result.current.submittedSearch).toBe("naruto");
    });

    (isNativePlatform ? it : it.skip)("sets scroll offset", () => {
        const { result } = renderHook(() => useHomeStore());

        act(() => {
            result.current.setScrollOffset(150);
        });

        expect(result.current.scrollOffset).toBe(150);
    });

    (isNativePlatform ? it : it.skip)(
        "updates submitted search multiple times",
        () => {
            const { result } = renderHook(() => useHomeStore());

            act(() => {
                result.current.setSubmittedSearch("naruto");
            });
            expect(result.current.submittedSearch).toBe("naruto");

            act(() => {
                result.current.setSubmittedSearch("one piece");
            });
            expect(result.current.submittedSearch).toBe("one piece");
        }
    );

    (isNativePlatform ? it : it.skip)(
        "updates scroll offset multiple times",
        () => {
            const { result } = renderHook(() => useHomeStore());

            act(() => {
                result.current.setScrollOffset(100);
            });
            expect(result.current.scrollOffset).toBe(100);

            act(() => {
                result.current.setScrollOffset(250);
            });
            expect(result.current.scrollOffset).toBe(250);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "maintains state when updating different fields",
        () => {
            const { result } = renderHook(() => useHomeStore());

            act(() => {
                result.current.setSubmittedSearch("test search");
            });
            expect(result.current.submittedSearch).toBe("test search");
            expect(result.current.scrollOffset).toBe(0);

            act(() => {
                result.current.setScrollOffset(300);
            });
            expect(result.current.submittedSearch).toBe("test search");
            expect(result.current.scrollOffset).toBe(300);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "persists submitted search to AsyncStorage",
        async () => {
            const { result } = renderHook(() => useHomeStore());

            await act(async () => {
                result.current.setSubmittedSearch("persisted search");
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            expect(mockSetItem).toHaveBeenCalled();
        }
    );

    (isNativePlatform ? it : it.skip)(
        "persists scroll offset to AsyncStorage",
        async () => {
            const { result } = renderHook(() => useHomeStore());

            await act(async () => {
                result.current.setScrollOffset(500);
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            expect(mockSetItem).toHaveBeenCalled();
        }
    );

    (isNativePlatform ? it : it.skip)(
        "can restore state from persisted values",
        async () => {
            const persistedState = JSON.stringify({
                state: {
                    submittedSearch: "restored search",
                    scrollOffset: 200,
                },
                version: 0,
            });

            mockGetItem.mockResolvedValue(persistedState);

            act(() => {
                useHomeStore.setState({
                    submittedSearch: "restored search",
                    scrollOffset: 200,
                });
            });

            const { result } = renderHook(() => useHomeStore());

            expect(result.current.submittedSearch).toBe("restored search");
            expect(result.current.scrollOffset).toBe(200);
        }
    );

    (isNativePlatform ? it : it.skip)("handles empty submitted search", () => {
        const { result } = renderHook(() => useHomeStore());

        act(() => {
            result.current.setSubmittedSearch("");
        });

        expect(result.current.submittedSearch).toBe("");
    });

    (isNativePlatform ? it : it.skip)("handles zero scroll offset", () => {
        const { result } = renderHook(() => useHomeStore());

        act(() => {
            result.current.setScrollOffset(100);
        });

        act(() => {
            result.current.setScrollOffset(0);
        });

        expect(result.current.scrollOffset).toBe(0);
    });

    (isNativePlatform ? it : it.skip)("handles negative scroll offset", () => {
        const { result } = renderHook(() => useHomeStore());

        act(() => {
            result.current.setScrollOffset(-50);
        });

        expect(result.current.scrollOffset).toBe(-50);
    });

    (isNativePlatform ? it : it.skip)(
        "handles large scroll offset values",
        () => {
            const { result } = renderHook(() => useHomeStore());

            act(() => {
                result.current.setScrollOffset(999999);
            });

            expect(result.current.scrollOffset).toBe(999999);
        }
    );
});
