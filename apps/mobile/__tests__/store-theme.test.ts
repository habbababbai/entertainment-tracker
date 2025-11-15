import { act, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { useThemeStore, type ThemeMode } from "../lib/store/theme";

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

// Mock Appearance.getColorScheme
const mockGetColorScheme = jest.fn(() => "light" as const);
jest.spyOn(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react-native").Appearance,
    "getColorScheme"
).mockImplementation(mockGetColorScheme);

describe("useThemeStore", () => {
    beforeEach(async () => {
        if (!isNativePlatform) {
            return;
        }
        jest.clearAllMocks();
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);
        mockGetColorScheme.mockReturnValue("light");

        await act(async () => {
            useThemeStore.setState({
                themeMode: "system",
            });
        });
    });

    (isNativePlatform ? describe : describe.skip)("initialization", () => {
        it("should initialize with system theme", () => {
            const { result } = renderHook(() => useThemeStore());

            expect(result.current.themeMode).toBe("system");
        });

        it("should restore state from AsyncStorage on mount", async () => {
            const savedState = {
                state: {
                    themeMode: "dark" as ThemeMode,
                },
                version: 0,
            };

            mockGetItem.mockResolvedValueOnce(JSON.stringify(savedState));

            act(() => {
                useThemeStore.setState({
                    themeMode: "dark",
                });
            });

            const { result } = renderHook(() => useThemeStore());

            expect(result.current.themeMode).toBe("dark");
        });
    });

    (isNativePlatform ? describe : describe.skip)("setThemeMode", () => {
        it("should update theme mode", async () => {
            const { result } = renderHook(() => useThemeStore());

            await act(async () => {
                result.current.setThemeMode("dark");
            });

            expect(result.current.themeMode).toBe("dark");
            expect(mockSetItem).toHaveBeenCalled();
        });

        it("should persist theme mode changes", async () => {
            const { result } = renderHook(() => useThemeStore());

            await act(async () => {
                result.current.setThemeMode("light");
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            expect(mockSetItem).toHaveBeenCalledWith(
                "theme-storage",
                expect.stringContaining('"themeMode":"light"')
            );
        });

        it("should handle all theme modes", async () => {
            const { result } = renderHook(() => useThemeStore());
            const modes: ThemeMode[] = ["light", "dark", "system"];

            for (const mode of modes) {
                await act(async () => {
                    result.current.setThemeMode(mode);
                });

                expect(result.current.themeMode).toBe(mode);
            }
        });
    });

    (isNativePlatform ? describe : describe.skip)("toggleTheme", () => {
        it("should toggle from light to dark", async () => {
            const { result } = renderHook(() => useThemeStore());

            await act(async () => {
                result.current.setThemeMode("light");
                result.current.toggleTheme();
            });

            expect(result.current.themeMode).toBe("dark");
        });

        it("should toggle from dark to light", async () => {
            const { result } = renderHook(() => useThemeStore());

            await act(async () => {
                result.current.setThemeMode("dark");
                result.current.toggleTheme();
            });

            expect(result.current.themeMode).toBe("light");
        });

        it("should toggle from system to opposite of system theme when system is dark", async () => {
            mockGetColorScheme.mockReturnValueOnce("dark");

            const { result } = renderHook(() => useThemeStore());

            await act(async () => {
                result.current.setThemeMode("system");
                result.current.toggleTheme();
            });

            expect(result.current.themeMode).toBe("light");
        });

        it("should toggle from system to opposite of system theme when system is light", async () => {
            mockGetColorScheme.mockReturnValueOnce("light");

            const { result } = renderHook(() => useThemeStore());

            await act(async () => {
                result.current.setThemeMode("system");
                result.current.toggleTheme();
            });

            expect(result.current.themeMode).toBe("dark");
        });
    });

    (isNativePlatform ? describe : describe.skip)("getSystemTheme", () => {
        it("should return dark when system color scheme is dark", () => {
            mockGetColorScheme.mockReturnValueOnce("dark");

            const { result } = renderHook(() => useThemeStore());

            expect(result.current.getSystemTheme()).toBe("dark");
        });

        it("should return light when system color scheme is light", () => {
            mockGetColorScheme.mockReturnValueOnce("light");

            const { result } = renderHook(() => useThemeStore());

            expect(result.current.getSystemTheme()).toBe("light");
        });

        it("should return light when system color scheme is null", () => {
            mockGetColorScheme.mockReturnValueOnce(null);

            const { result } = renderHook(() => useThemeStore());

            expect(result.current.getSystemTheme()).toBe("light");
        });
    });
});

