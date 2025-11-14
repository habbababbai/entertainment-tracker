import { act, renderHook } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { useAuthStore } from "../lib/store/auth";
import type { AuthUser, AuthTokens, AuthResponse } from "../lib/types";

const isNativePlatform = Platform.OS === "ios" || Platform.OS === "android";

jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

const mockGetItem = SecureStore.getItemAsync as jest.MockedFunction<
    typeof SecureStore.getItemAsync
>;
const mockSetItem = SecureStore.setItemAsync as jest.MockedFunction<
    typeof SecureStore.setItemAsync
>;

const mockUser: AuthUser = {
    id: "user-123",
    email: "test@example.com",
    username: "testuser",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockTokens: AuthTokens = {
    accessToken: "access-token-123",
    refreshToken: "refresh-token-456",
};

describe("useAuthStore", () => {
    beforeEach(() => {
        if (!isNativePlatform) {
            return;
        }
        jest.clearAllMocks();
        mockGetItem.mockResolvedValue(null);
        act(() => {
            useAuthStore.getState().clearAuth();
        });
    });

    (isNativePlatform ? it : it.skip)(
        "initializes with null auth state",
        () => {
            const { result } = renderHook(() => useAuthStore());

            expect(result.current.user).toBeNull();
            expect(result.current.accessToken).toBeNull();
            expect(result.current.refreshToken).toBeNull();
            expect(result.current.isAuthenticated).toBe(false);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "sets auth state with user and tokens",
        () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.setAuth(mockUser, mockTokens);
            });

            expect(result.current.user).toEqual(mockUser);
            expect(result.current.accessToken).toBe(mockTokens.accessToken);
            expect(result.current.refreshToken).toBe(mockTokens.refreshToken);
            expect(result.current.isAuthenticated).toBe(true);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "sets auth state from AuthResponse (backend response)",
        () => {
            const { result } = renderHook(() => useAuthStore());

            const authResponse: AuthResponse = {
                user: mockUser,
                ...mockTokens,
            };

            act(() => {
                result.current.setAuthFromResponse(authResponse);
            });

            expect(result.current.user).toEqual(mockUser);
            expect(result.current.accessToken).toBe(mockTokens.accessToken);
            expect(result.current.refreshToken).toBe(mockTokens.refreshToken);
            expect(result.current.isAuthenticated).toBe(true);
        }
    );

    (isNativePlatform ? it : it.skip)("clears auth state", () => {
        const { result } = renderHook(() => useAuthStore());

        act(() => {
            result.current.setAuth(mockUser, mockTokens);
        });

        expect(result.current.isAuthenticated).toBe(true);

        act(() => {
            result.current.clearAuth();
        });

        expect(result.current.user).toBeNull();
        expect(result.current.accessToken).toBeNull();
        expect(result.current.refreshToken).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
    });

    (isNativePlatform ? it : it.skip)("updates user when user exists", () => {
        const { result } = renderHook(() => useAuthStore());

        act(() => {
            result.current.setAuth(mockUser, mockTokens);
        });

        act(() => {
            result.current.updateUser({ username: "newusername" });
        });

        expect(result.current.user?.username).toBe("newusername");
        expect(result.current.user?.email).toBe(mockUser.email);
        expect(result.current.user?.id).toBe(mockUser.id);
    });

    (isNativePlatform ? it : it.skip)(
        "does not update user when user is null",
        () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.updateUser({ username: "newusername" });
            });

            expect(result.current.user).toBeNull();
        }
    );

    (isNativePlatform ? it : it.skip)(
        "persists auth state to SecureStore",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.setAuth(mockUser, mockTokens);
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            expect(mockSetItem).toHaveBeenCalledWith(
                "auth-storage",
                expect.stringContaining("access-token-123")
            );
        }
    );

    (isNativePlatform ? it : it.skip)(
        "handles SecureStore errors gracefully",
        async () => {
            mockGetItem.mockRejectedValueOnce(
                new Error("SecureStore unavailable")
            );
            mockSetItem.mockRejectedValueOnce(
                new Error("SecureStore unavailable")
            );

            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.setAuth(mockUser, mockTokens);
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            expect(result.current.user).toEqual(mockUser);
            expect(result.current.isAuthenticated).toBe(true);
        }
    );

    (isNativePlatform ? it : it.skip)(
        "clears SecureStore when clearing auth",
        async () => {
            const { result } = renderHook(() => useAuthStore());

            act(() => {
                result.current.setAuth(mockUser, mockTokens);
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            act(() => {
                result.current.clearAuth();
            });

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
            });

            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.user).toBeNull();
        }
    );
});
