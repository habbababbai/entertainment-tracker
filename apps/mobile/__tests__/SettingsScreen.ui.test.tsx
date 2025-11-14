
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

jest.mock("../lib/store/auth", () => {
    const actual = jest.requireActual("../lib/store/auth");
    return {
        ...actual,
        useAuthStore: jest.fn(),
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

type AuthState = Parameters<Parameters<typeof useAuthStore>[0]>[0];

const mockUser = {
    id: "user-123",
    email: "test@example.com",
    username: "testuser",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
};

const mockClearAuth = jest.fn();

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

beforeEach(() => {
    jest.clearAllMocks();
    mockClearAuth.mockResolvedValue(undefined);
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
});
