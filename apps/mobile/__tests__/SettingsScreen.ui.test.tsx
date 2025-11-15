/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import {
    act,
    cleanup,
    fireEvent,
    render,
    waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import SettingsTab from "../app/(tabs)/settings";
import { useAuthStore } from "../lib/store/auth";
import { useThemeStore } from "../lib/store/theme";

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

jest.mock("../lib/store/auth", () => {
    const actual = jest.requireActual("../lib/store/auth");
    return {
        ...actual,
        useAuthStore: jest.fn(),
    };
});

jest.mock("../lib/store/theme", () => {
    const actual = jest.requireActual("../lib/store/theme");
    return {
        ...actual,
        useThemeStore: jest.fn(),
    };
});

jest.mock("../components/LoginScreen", () => {
    const React = require("react");
    const { View, Text } = require("react-native");
    return function MockLoginScreen() {
        return React.createElement(
            View,
            { testID: "login-screen" },
            React.createElement(Text, null, "Login Screen")
        );
    };
});

const useAuthStoreMock = useAuthStore as jest.MockedFunction<
    typeof useAuthStore
>;
const useThemeStoreMock = useThemeStore as jest.MockedFunction<
    typeof useThemeStore
>;

type AuthState = Parameters<Parameters<typeof useAuthStore>[0]>[0];

const mockUser = {
    id: "user-123",
    email: "test@example.com",
    username: "testuser",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
};

const mockClearAuth = jest.fn();
const mockSetThemeMode = jest.fn();
const mockToggleTheme = jest.fn();
const mockGetSystemTheme = jest.fn(() => "light" as "light" | "dark");

function renderSettingsTab() {
    return render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 0, right: 0, bottom: 0, left: 0 },
            }}
        >
            <SettingsTab />
        </SafeAreaProvider>
    );
}

// Track current theme mode for mocks
let currentThemeMode: "light" | "dark" | "system" = "system";

beforeEach(() => {
    jest.clearAllMocks();
    currentThemeMode = "system";
    mockClearAuth.mockResolvedValue(undefined);
    mockSetThemeMode.mockImplementation((mode) => {
        currentThemeMode = mode;
    });
    mockToggleTheme.mockImplementation(() => {});
    mockGetSystemTheme.mockReturnValue("light");

    useThemeStoreMock.mockImplementation(
        (selector?: (state: ReturnType<typeof useThemeStoreMock>) => unknown) => {
        const state = {
            themeMode: currentThemeMode,
            setThemeMode: mockSetThemeMode,
            toggleTheme: mockToggleTheme,
            getSystemTheme: mockGetSystemTheme,
        };

        if (!selector) {
            return state;
        }

        if (typeof selector === "function") {
            return selector(state);
        }

        return state;
    });
});

afterEach(() => {
    cleanup();
});

describe("SettingsTab UI", () => {
    it("shows LoginScreen when user is not authenticated", () => {
        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: false,
                    user: null,
                    clearAuth: mockClearAuth,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByTestId } = renderSettingsTab();

        expect(getByTestId("login-screen")).toBeTruthy();
    });

    it("shows SettingsScreen when user is authenticated", () => {
        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: mockUser,
                    clearAuth: mockClearAuth,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByText, queryByTestId } = renderSettingsTab();

        expect(getByText("Settings")).toBeTruthy();
        expect(queryByTestId("login-screen")).toBeNull();
    });

    it("displays user email", () => {
        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: mockUser,
                    clearAuth: mockClearAuth,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByText } = renderSettingsTab();

        expect(getByText("Email")).toBeTruthy();
        expect(getByText("test@example.com")).toBeTruthy();
    });

    it("displays user username", () => {
        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: mockUser,
                    clearAuth: mockClearAuth,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByText } = renderSettingsTab();

        expect(getByText("Username")).toBeTruthy();
        expect(getByText("testuser")).toBeTruthy();
    });

    it("displays member since date when createdAt is available", () => {
        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: mockUser,
                    clearAuth: mockClearAuth,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByText } = renderSettingsTab();

        expect(getByText("Member Since")).toBeTruthy();
        expect(getByText("1/1/2024")).toBeTruthy();
    });

    it("does not display member since when createdAt is missing", () => {
        const userWithoutCreatedAt = {
            ...mockUser,
            createdAt: undefined as unknown as string,
        };

        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: userWithoutCreatedAt,
                    clearAuth: mockClearAuth,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { queryByText } = renderSettingsTab();

        expect(queryByText("Member Since")).toBeNull();
    });

    it("calls clearAuth when logout button is pressed", async () => {
        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: mockUser,
                    clearAuth: mockClearAuth,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByText } = renderSettingsTab();

        const logoutButton = getByText("Logout");
        await act(async () => {
            fireEvent.press(logoutButton);
        });

        await waitFor(() => {
            expect(mockClearAuth).toHaveBeenCalledTimes(1);
        });
    });

    it("shows loading state during logout", async () => {
        let resolveLogout: () => void;
        const logoutPromise = new Promise<void>((resolve) => {
            resolveLogout = resolve;
        });

        const mockClearAuthAsync = jest.fn(() => logoutPromise);

        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: mockUser,
                    clearAuth: mockClearAuthAsync,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByText, queryByText } = renderSettingsTab();

        const logoutButton = getByText("Logout");
        await act(async () => {
            fireEvent.press(logoutButton);
        });

        expect(queryByText("Logout")).toBeNull();

        await act(async () => {
            resolveLogout();
            await logoutPromise;
        });

        await waitFor(() => {
            expect(queryByText("Logout")).toBeTruthy();
        });
    });

    it("disables logout button during logout", async () => {
        let resolveLogout: () => void;
        const logoutPromise = new Promise<void>((resolve) => {
            resolveLogout = resolve;
        });

        const mockClearAuthAsync = jest.fn(() => logoutPromise);

        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: mockUser,
                    clearAuth: mockClearAuthAsync,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByText, queryByText } = renderSettingsTab();

        const logoutButton = getByText("Logout");
        await act(async () => {
            fireEvent.press(logoutButton);
        });

        await waitFor(() => {
            expect(queryByText("Logout")).toBeNull();
        });

        await act(async () => {
            resolveLogout();
            await logoutPromise;
        });

        await waitFor(() => {
            const newLogoutButton = getByText("Logout");
            expect(newLogoutButton).toBeTruthy();
        });
    });

    it("displays account information section", () => {
        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: mockUser,
                    clearAuth: mockClearAuth,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByText } = renderSettingsTab();

        expect(getByText("Account Information")).toBeTruthy();
    });

    describe("Theme functionality", () => {
        it("displays Appearance section", () => {
            useAuthStoreMock.mockImplementation((selector) => {
                if (typeof selector === "function") {
                    const state: Partial<AuthState> = {
                        isAuthenticated: true,
                        user: mockUser,
                        clearAuth: mockClearAuth,
                    };
                    return selector(state as AuthState);
                }
                return false;
            });

            const { getByText } = renderSettingsTab();

            expect(getByText("Appearance")).toBeTruthy();
            expect(getByText("Use System Theme")).toBeTruthy();
        });

        it("displays theme toggle with correct label when in light mode", () => {
            currentThemeMode = "light";

            useAuthStoreMock.mockImplementation((selector) => {
                if (typeof selector === "function") {
                    const state: Partial<AuthState> = {
                        isAuthenticated: true,
                        user: mockUser,
                        clearAuth: mockClearAuth,
                    };
                    return selector(state as AuthState);
                }
                return false;
            });

            const { getByText } = renderSettingsTab();

            expect(getByText("Light Mode")).toBeTruthy();
        });

        it("displays theme toggle with correct label when in dark mode", () => {
            currentThemeMode = "dark";

            useAuthStoreMock.mockImplementation((selector) => {
                if (typeof selector === "function") {
                    const state: Partial<AuthState> = {
                        isAuthenticated: true,
                        user: mockUser,
                        clearAuth: mockClearAuth,
                    };
                    return selector(state as AuthState);
                }
                return false;
            });

            const { getByText } = renderSettingsTab();

            expect(getByText("Dark Mode")).toBeTruthy();
        });

        it("displays theme toggle with correct label when system theme is dark", () => {
            useAuthStoreMock.mockImplementation((selector) => {
                if (typeof selector === "function") {
                    const state: Partial<AuthState> = {
                        isAuthenticated: true,
                        user: mockUser,
                        clearAuth: mockClearAuth,
                    };
                    return selector(state as AuthState);
                }
                return false;
            });

            mockGetSystemTheme.mockReturnValue("dark");

            currentThemeMode = "system";

            const { getByText } = renderSettingsTab();

            expect(getByText("Dark Mode")).toBeTruthy();
        });

        it("enables system theme toggle when pressed", async () => {
            currentThemeMode = "light";

            useAuthStoreMock.mockImplementation((selector) => {
                if (typeof selector === "function") {
                    const state: Partial<AuthState> = {
                        isAuthenticated: true,
                        user: mockUser,
                        clearAuth: mockClearAuth,
                    };
                    return selector(state as AuthState);
                }
                return false;
            });

            const { UNSAFE_getAllByType } = renderSettingsTab();
            const switches = UNSAFE_getAllByType(
                require("react-native").Switch
            );

            const systemThemeSwitch = switches[0];
            expect(systemThemeSwitch.props.value).toBe(false);

            await act(async () => {
                systemThemeSwitch.props.onValueChange(true);
            });

            expect(mockSetThemeMode).toHaveBeenCalledWith("system");
        });

        it("disables system theme toggle when pressed from enabled state with dark system theme", async () => {
            useAuthStoreMock.mockImplementation((selector) => {
                if (typeof selector === "function") {
                    const state: Partial<AuthState> = {
                        isAuthenticated: true,
                        user: mockUser,
                        clearAuth: mockClearAuth,
                    };
                    return selector(state as AuthState);
                }
                return false;
            });

            currentThemeMode = "system";
            // Reset mock and set to return dark when called
            mockGetSystemTheme.mockReset();
            mockGetSystemTheme.mockReturnValue("dark");

            const { UNSAFE_getAllByType } = renderSettingsTab();
            const switches = UNSAFE_getAllByType(
                require("react-native").Switch
            );

            const systemThemeSwitch = switches[0];
            expect(systemThemeSwitch.props.value).toBe(true);

            await act(async () => {
                systemThemeSwitch.props.onValueChange(false);
            });

            expect(mockSetThemeMode).toHaveBeenCalledWith("dark");
        });

        it("disables system theme toggle when pressed from enabled state with light system theme", async () => {
            useAuthStoreMock.mockImplementation((selector) => {
                if (typeof selector === "function") {
                    const state: Partial<AuthState> = {
                        isAuthenticated: true,
                        user: mockUser,
                        clearAuth: mockClearAuth,
                    };
                    return selector(state as AuthState);
                }
                return false;
            });

            mockGetSystemTheme.mockReturnValue("light");

            currentThemeMode = "system";

            const { UNSAFE_getAllByType } = renderSettingsTab();
            const switches = UNSAFE_getAllByType(
                require("react-native").Switch
            );

            const systemThemeSwitch = switches[0];
            expect(systemThemeSwitch.props.value).toBe(true);

            await act(async () => {
                systemThemeSwitch.props.onValueChange(false);
            });

            expect(mockSetThemeMode).toHaveBeenCalledWith("light");
        });

        it("toggles theme from light to dark when system theme is disabled", async () => {
            currentThemeMode = "light";

            useAuthStoreMock.mockImplementation((selector) => {
                if (typeof selector === "function") {
                    const state: Partial<AuthState> = {
                        isAuthenticated: true,
                        user: mockUser,
                        clearAuth: mockClearAuth,
                    };
                    return selector(state as AuthState);
                }
                return false;
            });

            const { UNSAFE_getAllByType } = renderSettingsTab();
            const switches = UNSAFE_getAllByType(
                require("react-native").Switch
            );

            const themeToggleSwitch = switches[1];
            expect(themeToggleSwitch.props.disabled).toBe(false);
            expect(themeToggleSwitch.props.value).toBe(false);

            await act(async () => {
                themeToggleSwitch.props.onValueChange(true);
            });

            expect(mockToggleTheme).toHaveBeenCalledTimes(1);
        });

        it("disables theme toggle when system theme is enabled", () => {
            useAuthStoreMock.mockImplementation((selector) => {
                if (typeof selector === "function") {
                    const state: Partial<AuthState> = {
                        isAuthenticated: true,
                        user: mockUser,
                        clearAuth: mockClearAuth,
                    };
                    return selector(state as AuthState);
                }
                return false;
            });

            currentThemeMode = "system";

            const { UNSAFE_getAllByType } = renderSettingsTab();
            const switches = UNSAFE_getAllByType(
                require("react-native").Switch
            );

            const themeToggleSwitch = switches[1];
            expect(themeToggleSwitch.props.disabled).toBe(true);
        });

        it("enables theme toggle when system theme is disabled", () => {
            currentThemeMode = "dark";

            useAuthStoreMock.mockImplementation((selector) => {
                if (typeof selector === "function") {
                    const state: Partial<AuthState> = {
                        isAuthenticated: true,
                        user: mockUser,
                        clearAuth: mockClearAuth,
                    };
                    return selector(state as AuthState);
                }
                return false;
            });

            const { UNSAFE_getAllByType } = renderSettingsTab();
            const switches = UNSAFE_getAllByType(
                require("react-native").Switch
            );

            const themeToggleSwitch = switches[1];
            expect(themeToggleSwitch.props.disabled).toBe(false);
        });
    });

    it("renders reset password button", () => {
        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: mockUser,
                    clearAuth: mockClearAuth,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByText } = renderSettingsTab();

        expect(getByText("Reset Password")).toBeTruthy();
    });

    it("calls router.push when reset password button is pressed", async () => {
        const mockPush = jest.fn();
        jest.spyOn(require("expo-router"), "useRouter").mockReturnValue({
            push: mockPush,
            replace: jest.fn(),
            back: jest.fn(),
            canGoBack: jest.fn(() => true),
        } as Parameters<typeof mockUseRouter>[0]);

        useAuthStoreMock.mockImplementation((selector) => {
            if (typeof selector === "function") {
                const state: Partial<AuthState> = {
                    isAuthenticated: true,
                    user: mockUser,
                    clearAuth: mockClearAuth,
                };
                return selector(state as AuthState);
            }
            return false;
        });

        const { getByText } = renderSettingsTab();

        const resetPasswordButton = getByText("Reset Password");
        await act(async () => {
            fireEvent.press(resetPasswordButton);
        });

        expect(mockPush).toHaveBeenCalledWith("/reset-password");
    });
});
